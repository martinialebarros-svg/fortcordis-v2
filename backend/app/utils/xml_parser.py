"""Parser XML para exames de ecocardiograma (Vivid IQ e compatíveis)"""
import re
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup

def _parse_data_iso(data_str: str) -> str:
    """Converte data do formato brasileiro (DD/MM/YYYY) ou americano (MM/DD/YYYY) para ISO (YYYY-MM-DD)."""
    if not data_str:
        return ""
    
    data_str = data_str.strip()
    
    # Se já está no formato ISO, retorna
    if re.match(r"^\d{4}-\d{2}-\d{2}$", data_str):
        return data_str
    
    # Tenta formato DD/MM/YYYY ou DD-MM-YYYY
    match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", data_str)
    if match:
        dia, mes, ano = match.groups()
        return f"{ano}-{int(mes):02d}-{int(dia):02d}"
    
    # Tenta formato YYYY/MM/DD ou YYYY-MM-DD
    match = re.match(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$", data_str)
    if match:
        ano, mes, dia = match.groups()
        return f"{ano}-{int(mes):02d}-{int(dia):02d}"
    
    # Se não conseguiu converter, retorna a string original
    return data_str

def _parse_num(texto: str) -> Optional[float]:
    """Extrai o primeiro número decimal de uma string."""
    if not texto:
        return None
    s = str(texto).strip().lower()
    m = re.search(r"(\d+(?:[.,]\d+)?)", s)
    if not m:
        return None
    num = m.group(1).replace(",", ".")
    try:
        return float(num)
    except (ValueError, TypeError):
        return None

def _find_text_ci(soup, tag_names):
    """Retorna o texto do primeiro tag encontrado (case-insensitive)."""
    for nm in tag_names:
        try:
            tag = soup.find(lambda t, nm=nm: getattr(t, 'name', None) and str(t.name).lower() == str(nm).lower())
        except Exception:
            tag = None
        if tag:
            txt = (tag.get_text() or "").strip()
            if txt:
                return txt
    return ""

def extrair_peso_kg(soup) -> Optional[float]:
    """Tenta encontrar peso no XML (converte lb->kg se necessário)."""
    candidatos_tags = {"weight", "patientweight", "patient_weight", "bodyweight", "bw"}
    
    tags = soup.find_all(True)
    for t in tags:
        if not getattr(t, "name", None):
            continue
        nome = t.name.lower()
        if nome in candidatos_tags:
            txt = (t.get_text() or "").strip()
            val = _parse_num(txt)
            if val is None:
                continue
            txt_l = txt.lower()
            unit_attr = (t.get("unit") or t.get("Unit") or "").lower()
            if "lb" in txt_l or "lb" in unit_attr:
                val = val / 2.20462
            return val

    candidatos_param = {
        "weight", "patient weight", "patientweight", "body weight", "bodyweight", "bw"
    }
    
    for p in soup.find_all("parameter"):
        name_attr = p.get("NAME") or p.get("Name") or p.get("name") or ""
        name_l = str(name_attr).strip().lower()
        if name_l in candidatos_param:
            node_val = p.find("aver") or p.find("val") or p.find("value")
            txt = (node_val.get_text() if node_val else p.get_text() or "").strip()
            val = _parse_num(txt)
            if val is None:
                continue
            txt_l = txt.lower()
            if "lb" in txt_l:
                val = val / 2.20462
            return val

    return None

def buscar_parametro_por_name(soup, possible_names: list, tipo_valor: str = "aver") -> Optional[float]:
    """Busca um parâmetro pelo atributo NAME dentro de tags <parameter>."""
    name_lower = [n.lower() for n in possible_names]

    for p in soup.find_all("parameter"):
        name_attr = p.get("NAME") or p.get("Name") or p.get("name") or ""
        name_l = str(name_attr).strip().lower()

        if name_l in name_lower:
            if tipo_valor == "aver":
                node_val = p.find("aver") or p.find("val") or p.find("value")
            else:
                node_val = p.find(tipo_valor) or p.find("aver") or p.find("val") or p.find("value")

            txt = (node_val.get_text() if node_val else p.get_text() or "").strip()
            val = _parse_num(txt)
            if val is not None:
                # Verificar a unidade da medida
                unit = ""
                unit_node = p.find("unit")
                if unit_node:
                    unit = (unit_node.get_text() or "").strip().lower()

                # Verificar se é medida de comprimento (não converter volumes, velocidades, tempos etc.)
                # Inclui detecção por tokens para casos como "LA" e "AE" isolados.
                is_comprimento = any(termo in name_l for termo in [
                    "div", "siv", "plv", "lvid", "lvpw", "ivs", "ao",
                    "ap", "tapse", "mapse", "root", "diam", "atri"
                ]) or bool(re.search(r"(^|[\s/_\.-])(la|ae)([\s/_\.-]|$)", name_l))

                # Converter cm para mm (multiplicar por 10) APENAS para medidas de comprimento
                if unit == "cm" and is_comprimento:
                    val = val * 10
                # Se não tiver unidade, valor for < 10 E for medida de comprimento, assumir cm e converter
                elif not unit and val < 10 and is_comprimento and val > 0.5:
                    val = val * 10

                return val

    return None

def debug_listar_parametros(soup):
    """Lista todos os parâmetros encontrados no XML para debug."""
    print("[XML_PARSER DEBUG] === TODOS OS PARÂMETROS ENCONTRADOS ===")
    count = 0
    for p in soup.find_all("parameter"):
        name_attr = p.get("NAME") or p.get("Name") or p.get("name") or ""
        node_val = p.find("aver") or p.find("val") or p.find("value")
        txt = (node_val.get_text() if node_val else p.get_text() or "").strip()
        unit_node = p.find("unit")
        unit = (unit_node.get_text() or "").strip() if unit_node else ""
        if name_attr:
            print(f"  NAME='{name_attr}' VALUE='{txt}' UNIT='{unit}'")
            count += 1
    print(f"[XML_PARSER DEBUG] === FIM DOS PARÂMETROS ({count} encontrados) ===")


def parse_xml_eco(xml_content: bytes) -> Dict[str, Any]:
    """
    Parse XML de ecocardiograma e retorna dados estruturados.
    """
    try:
        soup = BeautifulSoup(xml_content, 'xml')
    except Exception:
        try:
            soup = BeautifulSoup(xml_content, 'lxml')
        except Exception:
            soup = BeautifulSoup(xml_content, 'html.parser')
    
    dados = {
        "paciente": {},
        "medidas": {},
        "clinica": "",
        "veterinario_solicitante": "",
    }
    
    # Debug: listar todos os parâmetros do XML
    debug_listar_parametros(soup)
    
    # ============== DADOS DO PACIENTE ==============
    
    # Nome do tutor e paciente (formato Vivid IQ: "SOBRENOME, NOME RACA")
    raw_last = _find_text_ci(soup, ['lastName']) or ""
    raw_first = _find_text_ci(soup, ['firstName']) or ""
    
    tutor = ""
    nome_animal = ""
    raca = ""
    
    if not raw_first and "," in raw_last:
        # Formato: "Sobrenome Tutor, Nome Animal Raca"
        parts = raw_last.split(",", 1)
        tutor = parts[0].strip()
        rest = parts[1].strip()
        if " " in rest:
            # Pega a última palavra como raça, o resto como nome
            words = rest.rsplit(" ", 1)
            nome_animal = words[0].strip()
            raca = words[1].strip() if len(words) > 1 else ""
        else:
            nome_animal = rest
    else:
        tutor = raw_last.strip()
        if " " in raw_first:
            words = raw_first.rsplit(" ", 1)
            nome_animal = words[0].strip()
            raca = words[1].strip() if len(words) > 1 else ""
        else:
            nome_animal = raw_first.strip()
    
    # Espécie
    especie = _find_text_ci(soup, ['Species']) or ""
    if not especie:
        cat = _find_text_ci(soup, ["Category", "category"]) or ""
        cat = cat.strip().upper()
        if cat == "C":
            especie = "Canina"
        elif cat == "F":
            especie = "Felina"
    
    # Normaliza espécie
    if especie:
        especie_lower = especie.lower()
        if "fel" in especie_lower or "gato" in especie_lower or "cat" in especie_lower:
            especie = "Felina"
        elif "can" in especie_lower or "cao" in especie_lower or "cão" in especie_lower or "dog" in especie_lower:
            especie = "Canina"
    
    # Peso
    peso_xml = extrair_peso_kg(soup)
    peso = f"{peso_xml:.2f}".rstrip("0").rstrip(".") if peso_xml else ""
    
    # Data do exame
    data_exame_raw = _find_text_ci(soup, [
        "StudyDate", "ExamDate", "ExamDateTime", "ExamDateTimeUTC", "StudyDateUTC", "date"
    ])
    data_exame = _parse_data_iso(data_exame_raw)
    
    # Idade
    idade = _find_text_ci(soup, ["age", "Age", "PatientAge"])
    
    # Telefone
    telefone = _find_text_ci(soup, ["phone", "Phone", "Telephone"])
    
    # Clínica / Instituição
    clinica = _find_text_ci(soup, ["freeTextAddress", "InstitutionName", "institutionname"])
    
    # Frequência cardíaca
    fc = _find_text_ci(soup, ["HeartRate", "heartRate", "heart_rate"])
    
    # Sexo
    sexo = ""
    tag_sex = soup.find('Sex') or soup.find('sex')
    if tag_sex:
        sexo_text = tag_sex.text.lower() if hasattr(tag_sex, 'text') else str(tag_sex).lower()
        if "f" in sexo_text or "fem" in sexo_text:
            sexo = "Fêmea"
        elif "m" in sexo_text:
            sexo = "Macho"
    
    # Data de nascimento
    nascimento = _find_text_ci(soup, ["birthdate", "BirthDate", "Birthdate", "PatientBirthDate"])
    
    # ============== DADOS DO PACIENTE ==============
    dados["paciente"] = {
        "nome": nome_animal.strip(),
        "tutor": tutor.strip(),
        "raca": raca.strip(),
        "especie": especie or "Canina",
        "peso": peso,
        "idade": idade,
        "sexo": sexo,
        "telefone": telefone,
        "data_exame": data_exame,
        "nascimento": nascimento,
    }
    
    # ============== MEDIDAS ECOCARDIOGRÁFICAS ==============
    
    medidas = {}
    
    # --- Medidas 2D ---
    # Ao Root Diam -> Aorta
    val = buscar_parametro_por_name(soup, ["2D/Ao Root Diam", "Ao Root Diam", "Ao Root", "AO ROOT"])
    if val: medidas["Aorta"] = val
    
    # Ao (nível AP) - mesma medida mas pode ter nome diferente
    val = buscar_parametro_por_name(soup, ["Ao", "Aorta", "AO"])
    if val: medidas["Ao_nivel_AP"] = val
    
    # LA (Left Atrium / AE) -> Átrio esquerdo
    val = buscar_parametro_por_name(soup, ["2D/LA", "LA", "Left Atrium", "D. AE", "AE", "Atrium"])
    if val:
        # Fallback defensivo para XMLs onde LA/AE vem em cm e não foi detectado pela regra geral.
        medidas["Atrio_esquerdo"] = val * 10 if 0 < val < 5 else val
    
    # LA/Ao Ratio -> AE/Ao
    val = buscar_parametro_por_name(soup, ["2D/LA/Ao", "LA/Ao", "LA/AO", "AE/Ao", "AE/AO"])
    if val: medidas["AE_Ao"] = val
    
    # AP (Artéria pulmonar)
    val = buscar_parametro_por_name(soup, ["PA", "Pulmonary Artery", "Artéria Pulmonar", "AP"])
    if val: medidas["AP"] = val
    
    # AP/Ao
    val = buscar_parametro_por_name(soup, ["PA/Ao", "AP/Ao", "Pulmonary Artery/Aorta"])
    if val: medidas["AP_Ao"] = val
    
    # --- Medidas M-Mode (MM) e 2D ---
    # Nota: Alguns aparelhos usam prefixo "MM/", outros usam "2D/"
    
    # IVSd -> SIVd
    val = buscar_parametro_por_name(soup, ["2D/IVSd", "MM/IVSd", "IVSd", "SIVd"])
    if val: medidas["SIVd"] = val

    # LVIDd -> DIVEd
    val = buscar_parametro_por_name(soup, ["2D/LVIDd", "MM/LVIDd", "LVIDd", "DIVEd"])
    if val: medidas["DIVEd"] = val

    # LVPWd -> PLVEd
    val = buscar_parametro_por_name(soup, ["2D/LVPWd", "MM/LVPWd", "LVPWd", "PPVEd", "PLVEd"])
    if val: medidas["PLVEd"] = val

    # IVSs -> SIVs
    val = buscar_parametro_por_name(soup, ["2D/IVSs", "MM/IVSs", "IVSs", "SIVs"])
    if val: medidas["SIVs"] = val

    # LVIDs -> DIVÉs
    val = buscar_parametro_por_name(soup, ["2D/LVIDs", "MM/LVIDs", "LVIDs", "DIVEs", "DIVÉs"])
    if val: medidas["DIVES"] = val

    # LVPWs -> PLVÉs
    val = buscar_parametro_por_name(soup, ["2D/LVPWs", "MM/LVPWs", "LVPWs", "PPVEs", "PLVÉs"])
    if val: medidas["PLVES"] = val
    
    # Volumes -> VDF (Teicholz)
    val = buscar_parametro_por_name(soup, ["2D/EDV(Teich)", "MM/EDV(Teich)", "EDV(Teich)", "VDF(Teich)", "EDV", "VDF"])
    if val: medidas["VDF"] = val
    
    val = buscar_parametro_por_name(soup, ["2D/ESV(Teich)", "MM/ESV(Teich)", "ESV(Teich)", "VSF(Teich)", "ESV", "VSF"])
    if val: medidas["VSF"] = val
    
    val = buscar_parametro_por_name(soup, ["2D/SV(Teich)", "MM/SV(Teich)", "SV(Teich)", "SV"])
    if val: medidas["SV"] = val
    
    # Função -> FE (Teicholz)
    val = buscar_parametro_por_name(soup, ["2D/EF(Teich)", "MM/EF(Teich)", "EF(Teich)", "EF", "FE(Teich)", "FE"])
    if val: medidas["FE_Teicholz"] = val
    
    # %FS -> Delta D / %FS
    val = buscar_parametro_por_name(soup, ["2D/%FS", "MM/%FS", "%FS", "Delta D", "FS"])
    if val: medidas["DeltaD_FS"] = val
    
    # RWT
    val = buscar_parametro_por_name(soup, ["2D/LVPW RWTd", "MM/LVPW RWTd", "RWTd", "RWT"])
    if val: medidas["RWT"] = val
    
    # DIVdN (normalizado) -> DIVEd normalizado
    val = buscar_parametro_por_name(soup, ["2D/LVIDdN", "DIVdN", "LVIDdN", "DIVEdN"])
    if val: medidas["DIVEd_normalizado"] = val
    
    # TAPSE
    val = buscar_parametro_por_name(soup, ["MM/TAPSE", "2D/TAPSE", "TAPSE"])
    if val: medidas["TAPSE"] = val

    # MAPSE
    val = buscar_parametro_por_name(soup, ["MM/MAPSE", "2D/MAPSE", "MAPSE"])
    if val: medidas["MAPSE"] = val
    
    # --- Medidas Doppler (PW) ---
    # Mitral Valve -> Diastólica
    val = buscar_parametro_por_name(soup, ["MV E Velocity", "Veloc. E VM", "MVE", "E Velocity", "Onda E"])
    if val: medidas["Onda_E"] = val
    
    val = buscar_parametro_por_name(soup, ["MV A Velocity", "Veloc. A VM", "MVA", "A Velocity", "Onda A"])
    if val: medidas["Onda_A"] = val
    
    val = buscar_parametro_por_name(soup, ["MV E/A Ratio", "E/A VM", "E/A Ratio", "MV_E_A", "E/A"])
    if val: medidas["E_A"] = val
    
    val = buscar_parametro_por_name(soup, ["MV Dec Time", "T.Des. VM", "Dec Time", "MV_DT", "TD"])
    if val: medidas["TD"] = val
    
    val = buscar_parametro_por_name(soup, ["MV Dec Slope", "Rampa Des.VM", "Dec Slope", "MV_Slope"])
    if val: medidas["MV_Slope"] = val
    
    # E' (E prime) -> e' Doppler tecidual
    val = buscar_parametro_por_name(soup, ["MV Eprime Velocity", "E'", "Eprime Velocity", "Eprime", "e'"])
    if val: medidas["e_doppler"] = val
    
    # a' -> a' Doppler tecidual
    val = buscar_parametro_por_name(soup, ["a´", "a'", "Aprime Velocity", "a'"])
    if val: medidas["a_doppler"] = val
    
    # E/E' -> E/E'
    val = buscar_parametro_por_name(soup, ["MV E/Eprime Ratio/Calc", "E/E'", "EEp"])
    if val: medidas["E_E_linha"] = val
    
    # IVRT -> TRIV
    val = buscar_parametro_por_name(soup, ["IVRT", "TRIV"])
    if val: medidas["TRIV"] = val
    
    # MR dp/dt
    val = buscar_parametro_por_name(soup, ["MR dp/dt", "Mitral Regurg dp/dt", "MR dpdt"])
    if val: medidas["MR_dp_dt"] = val
    
    # Aórtica -> Doppler Saídas
    val = buscar_parametro_por_name(soup, ["LVOT Vmax P", "Vmáx VSVE", "LVOT Vmax", "Aortic Vmax", "Vmax aorta"])
    if val: medidas["Vmax_aorta"] = val
    
    val = buscar_parametro_por_name(soup, ["LVOT maxPG", "máxPG VSVE", "LVOT max PG", "Aortic maxPG", "Gradiente aorta"])
    if val: medidas["Grad_aorta"] = val
    
    # Pulmonar -> Doppler Saídas
    val = buscar_parametro_por_name(soup, ["RVOT Vmax P", "Vmáx VSVD", "RVOT Vmax", "Pulmonic Vmax", "Vmax pulmonar"])
    if val: medidas["Vmax_pulmonar"] = val
    
    val = buscar_parametro_por_name(soup, ["RVOT maxPG", "maxPG VSVD", "RVOT max PG", "Pulmonic maxPG", "Gradiente pulmonar"])
    if val: medidas["Grad_pulmonar"] = val
    
    # --- Medidas de regurgitação (Continuous Wave) ---
    # MR (Mitral Regurgitation) -> IM (insuficiência mitral) Vmax
    val = buscar_parametro_por_name(soup, ["MR maxPG", "Mitral Regurg maxPG", "MR max PG", "IM Vmax"])
    if val: medidas["IM_Vmax"] = val
    
    # TR (Tricuspid Regurgitation) -> IT (insuficiência tricúspide) Vmax
    val = buscar_parametro_por_name(soup, ["TR maxPG", "Tricuspid Regurg maxPG", "TR max PG", "IT Vmax"])
    if val: medidas["IT_Vmax"] = val
    
    # AR (Aortic Regurgitation) -> IA (insuficiência aórtica) Vmax
    val = buscar_parametro_por_name(soup, ["AR maxPG", "Aortic Regurg maxPG", "AR max PG", "IA Vmax"])
    if val: medidas["IA_Vmax"] = val
    
    # PR (Pulmonic Regurgitation) -> IP (insuficiência pulmonar) Vmax
    val = buscar_parametro_por_name(soup, ["PR maxPG", "Pulmonic Regurg maxPG", "PR max PG", "IP Vmax"])
    if val: medidas["IP_Vmax"] = val
    
    # TDI_e_a ratio -> Doppler tecidual (Relação e'/a')
    if "e_doppler" in medidas and "a_doppler" in medidas and medidas["a_doppler"] > 0:
        medidas["doppler_tecidual_relacao"] = medidas["e_doppler"] / medidas["a_doppler"]
    
    dados["medidas"] = medidas
    dados["clinica"] = clinica.strip()
    dados["veterinario_solicitante"] = ""
    dados["fc"] = fc
    
    # Outros dados do exame
    dados["institution"] = _find_text_ci(soup, ["InstitutionName"])
    dados["operator"] = _find_text_ci(soup, ["operator", "operatorName", "OperatorName"])
    dados["study_id"] = _find_text_ci(soup, ["studyId", "StudyId"])
    dados["accession_number"] = _find_text_ci(soup, ["AccessionNumber"])
    
    # Log das medidas extraídas (apenas para debug)
    print(f"[XML_PARSER] Total de medidas extraídas: {len(medidas)}")
    if medidas:
        print(f"[XML_PARSER] Medidas: {medidas}")
    
    return dados
