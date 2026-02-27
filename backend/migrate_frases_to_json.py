"""
Script de migração: Transfere frases do banco SQLite para arquivos JSON.

Uso:
    cd backend
    python migrate_frases_to_json.py

O script vai:
1. Ler todas as frases do banco de dados
2. Adicionar ao arquivo data/frases.json
3. Fazer backup do arquivo anterior
"""
import json
import shutil
from datetime import datetime
from pathlib import Path

# Configuração
DATA_DIR = Path(__file__).parent / "data"
FRASES_FILE = DATA_DIR / "frases.json"
DB_PATH = Path(__file__).parent / "fortcordis.db"


def load_json(filepath: Path, default: dict = None) -> dict:
    """Carrega um arquivo JSON ou retorna o valor padrão."""
    if default is None:
        default = {"frases": []}
    if not filepath.exists():
        return default
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️  Erro ao carregar {filepath}: {e}")
        return default


def save_json(filepath: Path, data: dict):
    """Salva dados em um arquivo JSON."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_frases_from_db():
    """Busca frases do banco de dados SQLite."""
    try:
        from sqlalchemy import create_engine, text
        
        if not DB_PATH.exists():
            print(f"❌ Banco de dados não encontrado: {DB_PATH}")
            return []
        
        engine = create_engine(f"sqlite:///{DB_PATH}")
        
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id, chave, patologia, grau, valvas, camaras, funcao, 
                       pericardio, vasos, ad_vd, conclusao, detalhado, layout, 
                       ativo, created_at, updated_at
                FROM frases_qualitativas
                WHERE ativo = 1
            """))
            
            frases = []
            for row in result:
                frase = {
                    "id": row[0],
                    "chave": row[1],
                    "patologia": row[2],
                    "grau": row[3] or "Normal",
                    "valvas": row[4] or "",
                    "camaras": row[5] or "",
                    "funcao": row[6] or "",
                    "pericardio": row[7] or "",
                    "vasos": row[8] or "",
                    "ad_vd": row[9] or "",
                    "conclusao": row[10] or "",
                    "detalhado": json.loads(row[11]) if row[11] else {},
                    "layout": row[12] or "detalhado",
                    "ativo": row[13] or 1,
                    "created_at": row[14] if row[14] else datetime.now().isoformat(),
                    "updated_at": row[15] if row[15] else datetime.now().isoformat(),
                }
                frases.append(frase)
            
            return frases
            
    except ImportError as e:
        print(f"[ERRO] Erro ao importar dependencias: {e}")
        print("   Certifique-se de que o SQLAlchemy está instalado:")
        print("   pip install sqlalchemy")
        return []
    except Exception as e:
        print(f"[ERRO] Erro ao buscar frases do banco: {e}")
        return []


def main():
    print("=" * 60)
    print("MIGRACAO: Banco de Dados -> JSON")
    print("=" * 60)
    
    # 1. Carregar frases do banco
    print("\n[1] Buscando frases do banco de dados...")
    frases_db = get_frases_from_db()
    print(f"   Encontradas {len(frases_db)} frases no banco")
    
    if not frases_db:
        print("   [AVISO] Nenhuma frase para migrar")
        return
    
    # 2. Fazer backup do arquivo atual
    if FRASES_FILE.exists():
        backup_path = FRASES_FILE.with_suffix(f".json.backup.{datetime.now():%Y%m%d_%H%M%S}")
        shutil.copy(FRASES_FILE, backup_path)
        print(f"\n[2] Backup criado: {backup_path.name}")
    
    # 3. Carregar arquivo atual (se existir)
    data = load_json(FRASES_FILE, {"version": "1.0", "frases": []})
    frases_existentes = data.get("frases", [])
    print(f"   Arquivo JSON atual tem {len(frases_existentes)} frases")
    
    # 4. Merge das frases (evitar duplicatas por chave)
    chaves_existentes = {f.get("chave") for f in frases_existentes}
    frases_adicionadas = 0
    
    for frase in frases_db:
        chave = frase.get("chave")
        if chave and chave not in chaves_existentes:
            # Gerar novo ID se necessário
            max_id = max((f.get("id", 0) for f in frases_existentes), default=0)
            frase["id"] = max_id + 1
            frases_existentes.append(frase)
            chaves_existentes.add(chave)
            frases_adicionadas += 1
        else:
            # Atualizar frase existente se a do banco for mais recente
            for i, f in enumerate(frases_existentes):
                if f.get("chave") == chave:
                    # Preservar ID existente
                    frase["id"] = f.get("id")
                    frases_existentes[i] = frase
                    frases_adicionadas += 1
                    break
    
    # 5. Salvar arquivo atualizado
    data["frases"] = frases_existentes
    data["last_updated"] = datetime.now().isoformat()
    save_json(FRASES_FILE, data)
    
    print(f"\n[SUCESSO] Migracao concluida!")
    print(f"   • Frases do banco: {len(frases_db)}")
    print(f"   • Frases adicionadas/atualizadas: {frases_adicionadas}")
    print(f"   • Total no JSON: {len(frases_existentes)}")
    print(f"\nArquivo salvo: {FRASES_FILE}")
    
    # 6. Listar frases migradas
    print("\nFrases migradas:")
    for frase in frases_db[:5]:  # Mostrar primeiras 5
        print(f"   • {frase['chave']}")
    if len(frases_db) > 5:
        print(f"   ... e mais {len(frases_db) - 5} frases")
    
    print("\n" + "=" * 60)
    print("Proximos passos:")
    print("1. Verifique o arquivo data/frases.json")
    print("2. Commit as alterações: git add data/ && git commit -m 'migra frases para JSON'")
    print("3. Push para deploy: git push origin feature/laudos-pdf-imagens:stage")
    print("=" * 60)


if __name__ == "__main__":
    main()
