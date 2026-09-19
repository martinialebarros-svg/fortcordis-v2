"""Registro ORM dos modelos.

Importar este pacote e o que popula `Base.metadata`, e e desse metadata que
`backend/setup_database.py` parte no `create_all()`. Nao existe lista de modelos
em nenhum outro lugar — foi para acabar com uma lista paralela morta que este
arquivo passou a importar `configuracao`.

O que isso **nao** significa: estar aqui nao e o que faz a tabela existir.
Tabela nova no FortCordis vem por **migracao versionada** em
`backend/migrations/versions/`. Toda tabela criada desde 2026 tem migracao
propria, inclusive as registradas neste arquivo; o `create_all` so chega antes
por rodar primeiro em `setup_database.py`, e a migracao correspondente vira
no-op (cada uma guarda com `_table_exists`).

Por isso quatro modulos de modelo nao aparecem aqui e funcionam normalmente:
`agenda_formalizacao`, `alerta_interno`, `fiscal` e `whatsapp_bot`. As tabelas
deles nascem por migracao.

Regra pratica ao adicionar modelo: escreva a migracao — e ela que cria a tabela
nos ambientes. Registrar aqui e sobre o ORM, e nao substitui a migracao. A
excecao historica sao as tabelas anteriores ao runner de migracoes (caso de
`configuracoes`), em que o `create_all` segue sendo o unico criador.
"""

from app.models.user import User
from app.models.papel import Papel
from app.models.agendamento import Agendamento
from app.models.whatsapp_agenda_resposta import WhatsappAgendaResposta
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.laudo import Laudo, Exame
from app.models.catalogo_exame import CatalogoExame, PainelExame, PainelExameItem
from app.models.financeiro import (
    Transacao,
    BandeiraCartao,
    FormaPagamentoConfiguracao,
    OrdemServicoPagamento,
    CreditoFinanceiro,
    ContaPagar,
    ContaReceber,
    CustoFrota,
    VeiculoFrota,
    TelemetriaFrotaMensal,
    ConfigRateioFrota,
)
from app.models.frase import FraseQualitativa, FraseQualitativaHistorico
from app.models.imagem_laudo import ImagemLaudo, ImagemTemporaria
from app.models.laudo_pdf_job import LaudoPdfJob
from app.models.xml_import_job import XmlImportJob
from app.models.eco_study_import_job import EcoStudyImportJob
from app.models.tabela_preco import TabelaPreco, PrecoServico, PrecoServicoClinica
from app.models.ordem_servico import OrdemServico
from app.models.referencia_eco import ReferenciaEco
from app.models.configuracao import Configuracao, ConfiguracaoUsuario
from app.models.papel_permissao import PapelPermissao
from app.models.atendimento_clinico import (
    AnexoAtendimento,
    AlertaClinico,
    AtendimentoClinico,
    DocumentoAtendimento,
    DocumentoAtendimentoTemplate,
    EvolucaoClinica,
    Medicamento,
    PrescricaoClinica,
    PrescricaoItem,
    PrescricaoItemAjuste,
    UploadDedupeCleanupRun,
    UploadDedupeMetrica,
)
from app.models.auditoria_evento import AuditoriaEvento
from app.models.clinica_deslocamento import ClinicaDeslocamento
from app.models.cep_bairro_override import CepBairroOverride
from app.models.frase_atendimento_clinico import FraseAtendimentoClinico
from app.models.push_subscription import PushSubscription
from app.models.push_scheduled_notification import PushScheduledNotification
from app.models.google_maps_usage_metrica import GoogleMapsUsageMetrica
from app.models.runtime_http_latency_metric import RuntimeHttpLatencyMetric
from app.models.portal_access import PortalAccessChallenge
from app.models.portal_clinic_auth import (
    PortalAuthChallenge,
    PortalClinicAccount,
    PortalClinicInvite,
    PortalClinicSession,
    PortalPasswordResetToken,
)
from app.models.portal_partner import PortalPartnerProfile, PortalPartnerReleaseTarget
from app.models.portal_partner_auth import (
    PortalPartnerAccount,
    PortalPartnerAuthChallenge,
    PortalPartnerInvite,
    PortalPartnerPasswordResetToken,
    PortalPartnerSession,
)
from app.models.assistente_ia import (
    AssistenteIAAcaoPendente,
    AssistenteIAAprendizado,
    AssistenteIAConhecimentoDocumento,
    AssistenteIAConhecimentoTrecho,
    AssistenteIAConversa,
    AssistenteIAExecucao,
    AssistenteIAFeedback,
    AssistenteIAMemoria,
    AssistenteIAMemoriaVersao,
    AssistenteIAMensagem,
    AssistenteIAMissao,
    AssistenteIARegressaoCaso,
    AssistenteIARascunhoClinico,
)
from app.models.agenda_bloqueio import AgendaBloqueio
from app.models.ai_echo import (
    AIEchoApplication,
    AIEchoAudioAsset,
    AIEchoClinicalWarning,
    AIEchoFeedback,
    AIEchoFieldSuggestion,
    AIEchoMeasurement,
    AIEchoPhrasePreference,
    AIEchoSession,
    AIEchoTranscript,
    AIEchoVocabulary,
)
