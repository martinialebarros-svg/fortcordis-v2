from app.models.user import User
from app.models.papel import Papel
from app.models.agendamento import Agendamento
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.laudo import Laudo, Exame
from app.models.catalogo_exame import CatalogoExame, PainelExame, PainelExameItem
from app.models.financeiro import (
    Transacao,
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
from app.models.tabela_preco import TabelaPreco, PrecoServico, PrecoServicoClinica
from app.models.ordem_servico import OrdemServico
from app.models.referencia_eco import ReferenciaEco
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
