"""
Script completo de setup do banco de dados para FortCordis v2.
Cria todas as tabelas e executa os seeds necessários.
"""
import os
import sys

# Verificar se DATABASE_URL está definido
if not os.environ.get("DATABASE_URL"):
    print("⚠️  ATENÇÃO: DATABASE_URL não está definido!")
    print("Usando SQLite local como fallback: sqlite:///./fortcordis.db")
    os.environ["DATABASE_URL"] = "sqlite:///./fortcordis.db"

from app.db.database import engine, Base, SessionLocal
from app.models import (
    user, papel, agendamento, paciente, tutor, clinica, servico,
    laudo, financeiro, frase, imagem_laudo, tabela_preco, 
    ordem_servico, referencia_eco, configuracao, auditoria_evento
)
from app.utils.frases_seed import seed_frases
from migrations.runner import run_migrations

# Importar todos os modelos para o Base.metadata
MODELS = [
    user.User,
    papel.Papel,
    agendamento.Agendamento,
    paciente.Paciente,
    tutor.Tutor,
    clinica.Clinica,
    servico.Servico,
    laudo.Laudo,
    laudo.Exame,
    financeiro.Transacao,
    financeiro.ContaPagar,
    financeiro.ContaReceber,
    frase.FraseQualitativa,
    frase.FraseQualitativaHistorico,
    imagem_laudo.ImagemLaudo,
    imagem_laudo.ImagemTemporaria,
    tabela_preco.TabelaPreco,
    tabela_preco.PrecoServico,
    ordem_servico.OrdemServico,
    referencia_eco.ReferenciaEco,
    configuracao.Configuracao,
    configuracao.ConfiguracaoUsuario,
    auditoria_evento.AuditoriaEvento,
]

def criar_tabelas():
    """Cria todas as tabelas no banco de dados."""
    print("\n🔧 Criando tabelas...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tabelas criadas com sucesso!")
        return True
    except Exception as e:
        print(f"❌ Erro ao criar tabelas: {e}")
        return False

def executar_migracoes():
    """Executa migracoes versionadas para corrigir drift de schema."""
    print("\n🧱 Executando migracoes versionadas...")
    try:
        run_migrations()
        print("✅ Migracoes executadas com sucesso!")
        return True
    except Exception as e:
        print(f"❌ Erro ao executar migracoes: {e}")
        return False

def criar_tabelas_preco():
    """Cria as tabelas de preço padrão."""
    from app.models.tabela_preco import TabelaPreco
    
    db = SessionLocal()
    try:
        print("\n💰 Configurando tabelas de preço...")
        tabelas_padrao = [
            {"id": 1, "nome": "Clínicas Fortaleza", "descricao": "Tabela para clínicas na cidade de Fortaleza"},
            {"id": 2, "nome": "Região Metropolitana", "descricao": "Tabela para clínicas na região metropolitana de Fortaleza"},
            {"id": 3, "nome": "Atendimento Domiciliar", "descricao": "Tabela para atendimentos domiciliares"},
        ]
        
        for tabela_data in tabelas_padrao:
            existing = db.query(TabelaPreco).filter(TabelaPreco.id == tabela_data["id"]).first()
            if not existing:
                tabela = TabelaPreco(**tabela_data, ativo=1)
                db.add(tabela)
                print(f"  ✅ Tabela '{tabela_data['nome']}' criada")
            else:
                print(f"  ⏭️  Tabela '{tabela_data['nome']}' já existe")
        
        db.commit()
        print("✅ Tabelas de preço configuradas!")
    except Exception as e:
        print(f"❌ Erro ao criar tabelas de preço: {e}")
        db.rollback()
    finally:
        db.close()

def seed_frases_qualitativas():
    """Executa o seed de frases qualitativas."""
    db = SessionLocal()
    try:
        print("\n📝 Adicionando frases qualitativas...")
        seed_frases(db)
        print("✅ Frases qualitativas configuradas!")
    except Exception as e:
        print(f"❌ Erro ao adicionar frases: {e}")
        db.rollback()
    finally:
        db.close()

def verificar_tabelas():
    """Verifica se todas as tabelas existem."""
    from sqlalchemy import inspect
    
    print("\n🔍 Verificando tabelas...")
    inspector = inspect(engine)
    tabelas_existentes = inspector.get_table_names()
    
    tabelas_esperadas = [
        "usuarios", "papeis", "usuario_papel",
        "agendamentos", "pacientes", "tutores", "clinicas", "servicos",
        "laudos", "exames", "transacoes", "contas_pagar", "contas_receber",
        "frases_qualitativas", "frases_qualitativas_historico",
        "imagens_laudo", "imagens_temporarias",
        "tabelas_preco", "precos_servicos", "ordens_servico",
        "referencias_eco", "configuracoes", "configuracoes_usuario"
        , "auditoria_eventos"
    ]
    
    todas_ok = True
    for tabela in tabelas_esperadas:
        if tabela in tabelas_existentes:
            print(f"  ✅ {tabela}")
        else:
            print(f"  ❌ {tabela} - NÃO ENCONTRADA")
            todas_ok = False
    
    return todas_ok

def verificar_dados():
    """Verifica se há dados básicos nas tabelas."""
    db = SessionLocal()
    try:
        print("\n📊 Verificando dados...")
        
        # Contar registros em tabelas importantes
        from app.models.frase import FraseQualitativa
        from app.models.tabela_preco import TabelaPreco
        from app.models.clinica import Clinica
        
        frases_count = db.query(FraseQualitativa).count()
        tabelas_count = db.query(TabelaPreco).count()
        clinicas_count = db.query(Clinica).count()
        
        print(f"  Frases qualitativas: {frases_count}")
        print(f"  Tabelas de preço: {tabelas_count}")
        print(f"  Clínicas: {clinicas_count}")
        
        if frases_count == 0:
            print("  ⚠️  Nenhuma frase qualitativa encontrada!")
        if tabelas_count == 0:
            print("  ⚠️  Nenhuma tabela de preço encontrada!")
            
    except Exception as e:
        print(f"❌ Erro ao verificar dados: {e}")
    finally:
        db.close()

def main():
    """Função principal de setup."""
    print("=" * 60)
    print("🚀 SETUP DO BANCO DE DADOS - FORTCORDIS v2")
    print("=" * 60)
    print(f"\n📡 Database URL: {os.environ.get('DATABASE_URL', 'Não definido')}")
    
    # 1. Criar tabelas
    if not criar_tabelas():
        print("\n❌ Falha ao criar tabelas. Abortando.")
        sys.exit(1)
    
    # 1.1 Executar migracoes versionadas
    if not executar_migracoes():
        print("\n❌ Falha ao executar migracoes. Abortando.")
        sys.exit(1)
    
    # 2. Verificar tabelas
    if not verificar_tabelas():
        print("\n⚠️  Algumas tabelas não foram criadas corretamente.")
    
    # 3. Criar dados iniciais
    criar_tabelas_preco()
    seed_frases_qualitativas()
    
    # 4. Verificar dados
    verificar_dados()
    
    print("\n" + "=" * 60)
    print("✅ SETUP CONCLUÍDO!")
    print("=" * 60)

if __name__ == "__main__":
    main()
