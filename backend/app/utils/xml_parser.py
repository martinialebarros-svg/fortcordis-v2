"""Parser XML para exames de ecocardiograma (Vivid IQ e compatíveis)"""
import re
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup

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
                return val
    
    return None

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
    data_exame = _find_text_ci(soup, [
        "StudyDate", "ExamDate", "ExamDateTime", "ExamDateTimeUTC", "StudyDateUTC", "date"
    ])
    
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
    # Ao Root Diam
    val = buscar_parametro_por_name(soup, ["2D/Ao Root Diam", "Ao Root Diam", "Ao Root", "AO ROOT"])
    if val: medidas["Ao"] = val
    
    # LA (Left Atrium / AE)
    val = buscar_parametro_por_name(soup, ["2D/LA", "LA", "Left Atrium", "D. AE"])
    if val: medidas["LA"] = val
    
    # LA/Ao Ratio
    val = buscar_parametro_por_name(soup, ["2D/LA/Ao", "LA/Ao", "LA/AO", "AE/Ao", "AE/AO"])
    if val: medidas["LA_Ao"] = val
    
    # Ao/LA Ratio
    val = buscar_parametro_por_name(soup, ["2D/Ao/LA", "Ao/LA", "Ao/AE"])
    if val: medidas["Ao_LA"] = val
    
    # --- Medidas M-Mode (MM) ---
    # IVSd
    val = buscar_parametro_por_name(soup, ["MM/IVSd", "IVSd", "SIVd"])
    if val: medidas["IVSd"] = val / 10 if val > 10 else val  # converter mm para cm se necessário
    
    # LVIDd
    val = buscar_parametro_por_name(soup, ["MM/LVIDd", "LVIDd", "DIVEd"])
    if val: medidas["LVIDd"] = val / 10 if val > 10 else val
    
    # LVPWd
    val = buscar_parametro_por_name(soup, ["MM/LVPWd", "LVPWd", "PPVEd"])
    if val: medidas["LVPWd"] = val / 10 if val > 10 else val
    
    # IVSs
    val = buscar_parametro_por_name(soup, ["MM/IVSs", "IVSs", "SIVs"])
    if val: medidas["IVSs"] = val / 10 if val > 10 else val
    
    # LVIDs
    val = buscar_parametro_por_name(soup, ["MM/LVIDs", "LVIDs", "DIVEs"])
    if val: medidas["LVIDs"] = val / 10 if val > 10 else val
    
    # LVPWs
    val = buscar_parametro_por_name(soup, ["MM/LVPWs", "LVPWs", "PPVEs"])
    if val: medidas["LVPWs"] = val / 10 if val > 10 else val
    
    # Volumes
    val = buscar_parametro_por_name(soup, ["MM/EDV(Teich)", "EDV(Teich)", "VDF(Teich)", "EDV"])
    if val: medidas["EDV"] = val
    
    val = buscar_parametro_por_name(soup, ["MM/ESV(Teich)", "ESV(Teich)", "VSF(Teich)", "ESV"])
    if val: medidas["ESV"] = val
    
    val = buscar_parametro_por_name(soup, ["MM/SV(Teich)", "SV(Teich)", "SV"])
    if val: medidas["SV"] = val
    
    # Função
    val = buscar_parametro_por_name(soup, ["MM/EF(Teich)", "EF(Teich)", "EF", "FE(Teich)", "FE"])
    if val: medidas["EF"] = val
    
    val = buscar_parametro_por_name(soup, ["MM/%FS", "%FS", "Delta D", "FS"])
    if val: medidas["FS"] = val
    
    # RWT
    val = buscar_parametro_por_name(soup, ["MM/LVPW RWTd", "RWTd", "RWT"])
    if val: medidas["RWT"] = val
    
    # DIVdN (normalizado)
    val = buscar_parametro_por_name(soup, ["DIVdN", "LVIDdN"])
    if val: medidas["DIVdN"] = val
    
    # TAPSE
    val = buscar_parametro_por_name(soup, ["MM/TAPSE", "TAPSE"])
    if val: medidas["TAPSE"] = val / 10 if val > 10 else val
    
    # MAPSE
    val = buscar_parametro_por_name(soup, ["MM/MAPSE", "MAPSE"])
    if val: medidas["MAPSE"] = val / 10 if val > 10 else val
    
    # --- Medidas Doppler (PW) ---
    # Mitral Valve
    val = buscar_parametro_por_name(soup, ["MV E Velocity", "Veloc. E VM", "MVE", "E Velocity"])
    if val: medidas["MV_E"] = val
    
    val = buscar_parametro_por_name(soup, ["MV A Velocity", "Veloc. A VM", "MVA", "A Velocity"])
    if val: medidas["MV_A"] = val
    
    val = buscar_parametro_por_name(soup, ["MV E/A Ratio", "E/A VM", "E/A Ratio", "MV_E_A"])
    if val: medidas["MV_E_A"] = val
    
    val = buscar_parametro_por_name(soup, ["MV Dec Time", "T.Des. VM", "Dec Time", "MV_DT"])
    if val: medidas["MV_DT"] = val
    
    val = buscar_parametro_por_name(soup, ["MV Dec Slope", "Rampa Des.VM", "Dec Slope", "MV_Slope"])
    if val: medidas["MV_Slope"] = val
    
    # E' (E prime)
    val = buscar_parametro_por_name(soup, ["MV Eprime Velocity", "E'", "Eprime Velocity", "Eprime"])
    if val: medidas["TDI_e"] = val
    
    # a'
    val = buscar_parametro_por_name(soup, ["a´", "a'", "Aprime Velocity"])
    if val: medidas["TDI_a"] = val
    
    # E/E'
    val = buscar_parametro_por_name(soup, ["MV E/Eprime Ratio/Calc", "E/E'", "EEp"])
    if val: medidas["EEp"] = val
    
    # IVRT
    val = buscar_parametro_por_name(soup, ["IVRT", "TRIV"])
    if val: medidas["IVRT"] = val
    
    # Aórtica
    val = buscar_parametro_por_name(soup, ["LVOT Vmax P", "Vmáx VSVE", "LVOT Vmax", "Aortic Vmax"])
    if val: medidas["Vmax_Ao"] = val
    
    val = buscar_parametro_por_name(soup, ["LVOT maxPG", "máxPG VSVE", "LVOT max PG", "Aortic maxPG"])
    if val: medidas["Grad_Ao"] = val
    
    # Pulmonar
    val = buscar_parametro_por_name(soup, ["RVOT Vmax P", "Vmáx VSVD", "RVOT Vmax", "Pulmonic Vmax"])
    if val: medidas["Vmax_Pulm"] = val
    
    val = buscar_parametro_por_name(soup, ["RVOT maxPG", "maxPG VSVD", "RVOT max PG", "Pulmonic maxPG"])
    if val: medidas["Grad_Pulm"] = val
    
    # --- Medidas de regurgitação (Continuous Wave) ---
    # MR (Mitral Regurgitation)
    val = buscar_parametro_por_name(soup, ["MR maxPG", "Mitral Regurg maxPG", "MR max PG"])
    if val: medidas["MR_Vmax"] = val
    
    # TR (Tricuspid Regurgitation)
    val = buscar_parametro_por_name(soup, ["TR maxPG", "Tricuspid Regurg maxPG", "TR max PG"])
    if val: medidas["TR_Vmax"] = val
    
    # AR (Aortic Regurgitation)
    val = buscar_parametro_por_name(soup, ["AR maxPG", "Aortic Regurg maxPG", "AR max PG"])
    if val: medidas["AR_Vmax"] = val
    
    # PR (Pulmonic Regurgitation)
    val = buscar_parametro_por_name(soup, ["PR maxPG", "Pulmonic Regurg maxPG", "PR max PG"])
    if val: medidas["PR_Vmax"] = val
    
    # TDI_e_a ratio
    if "TDI_e" in medidas and "TDI_a" in medidas and medidas["TDI_a"] > 0:
        medidas["TDI_e_a"] = medidas["TDI_e"] / medidas["TDI_a"]
    
    dados["medidas"] = medidas
    dados["clinica"] = clinica.strip()
    dados["veterinario_solicitante"] = ""
    dados["fc"] = fc
    
    # Outros dados do exame
    dados["institution"] = _find_text_ci(soup, ["InstitutionName"])
    dados["operator"] = _find_text_ci(soup, ["operator", "operatorName", "OperatorName"])
    dados["study_id"] = _find_text_ci(soup, ["studyId", "StudyId"])
    dados["accession_number"] = _find_text_ci(soup, ["AccessionNumber"])
    
    return dados
