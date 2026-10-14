"""Explicit acquisition confirmations used by echo reference comparisons."""

ECHO_REFERENCE_METHOD_VALUES: dict[str, frozenset[str]] = {
    "TAPSE_metodo": frozenset({"modo_m_apical", "2d"}),
    "AE_Ao_metodo": frozenset({
        "2d_eixo_curto_diastole_inicial",
        "2d_eixo_curto_diastole_inicial_sueco",
        "outro",
    }),
    "Diastolica_metodo": frozenset({
        "felino_adulto_nao_sedado_pw_clique_aortico",
        "felino_adulto_nao_sedado_pw_fim_fluxo",
        "outro",
    }),
    "Diastolica_ondas": frozenset({"separadas", "fundidas"}),
    "TDI_metodo": frozenset({"felino_pw_anel_lateral", "felino_pw_anel_septal", "outro"}),
    "TDI_ondas": frozenset({"separadas", "fundidas"}),
}
