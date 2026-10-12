"""Explicit acquisition confirmations used by echo reference comparisons."""

ECHO_REFERENCE_METHOD_VALUES: dict[str, frozenset[str]] = {
    "TAPSE_metodo": frozenset({"modo_m_apical", "2d"}),
    "AE_Ao_metodo": frozenset({"2d_eixo_curto_diastole_inicial", "outro"}),
}
