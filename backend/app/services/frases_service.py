"""
Service para gerenciamento de frases qualitativas via arquivos JSON.
As frases são armazenadas em arquivos versionados no Git em vez do banco de dados.
"""
import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path

# Diretório onde os arquivos JSON estão localizados
DATA_DIR = Path(__file__).parent.parent.parent / "data"
FRASES_FILE = DATA_DIR / "frases.json"
PATOLOGIAS_FILE = DATA_DIR / "patologias.json"


def _ensure_data_dir():
    """Garante que o diretório de dados existe."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_json(filepath: Path, default: Any = None) -> Any:
    """Carrega um arquivo JSON ou retorna o valor padrão se não existir."""
    if not filepath.exists():
        return default
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return default


def _save_json(filepath: Path, data: Any):
    """Salva dados em um arquivo JSON."""
    _ensure_data_dir()
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _generate_id(frases: List[Dict]) -> int:
    """Gera um novo ID baseado nos IDs existentes."""
    if not frases:
        return 1
    return max(f.get("id", 0) for f in frases) + 1


# =============================================================================
# OPERAÇÕES COM FRASES
# =============================================================================

def listar_frases(
    patologia: Optional[str] = None,
    grau: Optional[str] = None,
    busca: Optional[str] = None,
    ativo: Optional[int] = 1,
    skip: int = 0,
    limit: int = 100
) -> Dict[str, Any]:
    """Lista todas as frases qualitativas com filtros opcionais."""
    data = _load_json(FRASES_FILE, {"frases": []})
    frases = data.get("frases", [])
    
    # Aplicar filtros
    if ativo is not None:
        frases = [f for f in frases if f.get("ativo", 1) == ativo]
    
    if patologia:
        frases = [f for f in frases if patologia.lower() in f.get("patologia", "").lower()]
    
    if grau:
        frases = [f for f in frases if grau.lower() in f.get("grau", "").lower()]
    
    if busca:
        busca_lower = busca.lower()
        frases = [
            f for f in frases 
            if (busca_lower in f.get("patologia", "").lower() or
                busca_lower in f.get("chave", "").lower() or
                busca_lower in f.get("conclusao", "").lower())
        ]
    
    total = len(frases)
    items = frases[skip:skip + limit]
    
    return {"items": items, "total": total}


def obter_frase(frase_id: int) -> Optional[Dict]:
    """Obtém uma frase específica pelo ID."""
    data = _load_json(FRASES_FILE, {"frases": []})
    for frase in data.get("frases", []):
        if frase.get("id") == frase_id and frase.get("ativo", 1) == 1:
            return frase
    return None


def obter_frase_por_chave(chave: str) -> Optional[Dict]:
    """Obtém uma frase específica pela chave."""
    data = _load_json(FRASES_FILE, {"frases": []})
    for frase in data.get("frases", []):
        if frase.get("chave") == chave and frase.get("ativo", 1) == 1:
            return frase
    return None


def criar_frase(frase_data: Dict[str, Any]) -> Dict[str, Any]:
    """Cria uma nova frase qualitativa."""
    data = _load_json(FRASES_FILE, {"frases": [], "version": "1.0"})
    frases = data.get("frases", [])
    
    # Verificar se já existe chave
    chave = frase_data.get("chave")
    if chave and any(f.get("chave") == chave for f in frases):
        raise ValueError(f"Já existe uma frase com a chave '{chave}'")
    
    # Criar nova frase
    nova_frase = {
        "id": _generate_id(frases),
        "chave": frase_data.get("chave", ""),
        "patologia": frase_data.get("patologia", ""),
        "grau": frase_data.get("grau", "Normal"),
        "valvas": frase_data.get("valvas", ""),
        "camaras": frase_data.get("camaras", ""),
        "funcao": frase_data.get("funcao", ""),
        "pericardio": frase_data.get("pericardio", ""),
        "vasos": frase_data.get("vasos", ""),
        "ad_vd": frase_data.get("ad_vd", ""),
        "conclusao": frase_data.get("conclusao", ""),
        "detalhado": frase_data.get("detalhado", {}),
        "layout": frase_data.get("layout", "detalhado"),
        "ativo": 1,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    
    frases.append(nova_frase)
    data["frases"] = frases
    data["last_updated"] = datetime.now().isoformat()
    
    _save_json(FRASES_FILE, data)
    return nova_frase


def atualizar_frase(frase_id: int, frase_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Atualiza uma frase existente."""
    data = _load_json(FRASES_FILE, {"frases": []})
    frases = data.get("frases", [])
    
    for i, frase in enumerate(frases):
        if frase.get("id") == frase_id:
            # Atualizar apenas os campos fornecidos
            for key, value in frase_data.items():
                if value is not None and key not in ["id", "created_at"]:
                    frase[key] = value
            
            frase["updated_at"] = datetime.now().isoformat()
            frases[i] = frase
            
            data["frases"] = frases
            data["last_updated"] = datetime.now().isoformat()
            _save_json(FRASES_FILE, data)
            return frase
    
    return None


def deletar_frase(frase_id: int) -> bool:
    """Remove uma frase (soft delete - apenas marca como inativo)."""
    data = _load_json(FRASES_FILE, {"frases": []})
    frases = data.get("frases", [])
    
    for frase in frases:
        if frase.get("id") == frase_id:
            frase["ativo"] = 0
            frase["updated_at"] = datetime.now().isoformat()
            
            data["frases"] = frases
            data["last_updated"] = datetime.now().isoformat()
            _save_json(FRASES_FILE, data)
            return True
    
    return False


def restaurar_frase(frase_id: int) -> bool:
    """Restaura uma frase removida."""
    data = _load_json(FRASES_FILE, {"frases": []})
    frases = data.get("frases", [])
    
    for frase in frases:
        if frase.get("id") == frase_id:
            frase["ativo"] = 1
            frase["updated_at"] = datetime.now().isoformat()
            
            data["frases"] = frases
            data["last_updated"] = datetime.now().isoformat()
            _save_json(FRASES_FILE, data)
            return True
    
    return False


def buscar_frase_por_patologia_grau(
    patologia: str,
    grau_refluxo: Optional[str] = None,
    grau_geral: Optional[str] = None
) -> Optional[Dict]:
    """Busca uma frase específica por patologia e grau."""
    # Montar a chave esperada
    if patologia == "Normal":
        chave = "Normal (Normal)"
    elif patologia == "Endocardiose Mitral":
        chave = f"{patologia} ({grau_refluxo or 'Leve'})"
    else:
        chave = f"{patologia} ({grau_geral or 'Leve'})"
    
    # Tentar buscar pela chave exata
    frase = obter_frase_por_chave(chave)
    if frase:
        return frase
    
    # Se não encontrar, buscar apenas pela patologia
    data = _load_json(FRASES_FILE, {"frases": []})
    for f in data.get("frases", []):
        if (patologia.lower() in f.get("patologia", "").lower() and 
            f.get("ativo", 1) == 1):
            return f
    
    return None


# =============================================================================
# OPERAÇÕES COM PATOLOGIAS
# =============================================================================

def listar_patologias() -> List[str]:
    """Lista todas as patologias disponíveis."""
    data = _load_json(PATOLOGIAS_FILE, {"patologias": []})
    patologias = [p.get("nome") for p in data.get("patologias", []) if p.get("nome")]
    return sorted(patologias)


def listar_graus_por_patologia(patologia: Optional[str] = None) -> List[str]:
    """Lista todos os graus disponíveis, opcionalmente filtrados por patologia."""
    data = _load_json(PATOLOGIAS_FILE, {"patologias": []})
    
    if patologia:
        for p in data.get("patologias", []):
            if p.get("nome") == patologia:
                return p.get("graus", [])
        return []
    
    # Retorna todos os graus únicos
    graus_set = set()
    for p in data.get("patologias", []):
        graus_set.update(p.get("graus", []))
    return sorted(list(graus_set))


def adicionar_patologia(nome: str, graus: List[str]) -> bool:
    """Adiciona uma nova patologia ao arquivo."""
    data = _load_json(PATOLOGIAS_FILE, {"patologias": [], "version": "1.0"})
    patologias = data.get("patologias", [])
    
    # Verificar se já existe
    if any(p.get("nome") == nome for p in patologias):
        return False
    
    patologias.append({"nome": nome, "graus": graus})
    data["patologias"] = patologias
    data["last_updated"] = datetime.now().isoformat()
    
    _save_json(PATOLOGIAS_FILE, data)
    return True


def atualizar_patologia(nome: str, graus: List[str]) -> bool:
    """Atualiza os graus de uma patologia existente."""
    data = _load_json(PATOLOGIAS_FILE, {"patologias": []})
    patologias = data.get("patologias", [])
    
    for p in patologias:
        if p.get("nome") == nome:
            p["graus"] = graus
            data["patologias"] = patologias
            data["last_updated"] = datetime.now().isoformat()
            _save_json(PATOLOGIAS_FILE, data)
            return True
    
    return False
