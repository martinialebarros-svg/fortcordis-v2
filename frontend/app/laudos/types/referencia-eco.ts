export interface ReferenciaEco {
  id: number;
  especie: "Canina" | "Felina";
  peso_kg: number;
  
  // Medidas estruturais (VE - Modo M)
  lvid_d_min?: number;
  lvid_d_max?: number;
  lvid_s_min?: number;
  lvid_s_max?: number;
  ivs_d_min?: number;
  ivs_d_max?: number;
  ivs_s_min?: number;
  ivs_s_max?: number;
  lvpw_d_min?: number;
  lvpw_d_max?: number;
  lvpw_s_min?: number;
  lvpw_s_max?: number;
  
  // Função
  fs_min?: number;
  fs_max?: number;
  ef_min?: number;
  ef_max?: number;
  tapse_min?: number;
  tapse_max?: number;
  mapse_min?: number;
  mapse_max?: number;
  
  // Vasos (Aorta e Átrio Esquerdo)
  ao_min?: number;
  ao_max?: number;
  la_min?: number;
  la_max?: number;
  la_ao_min?: number;
  la_ao_max?: number;
  
  // Artéria Pulmonar
  ap_min?: number;
  ap_max?: number;
  ap_ao_min?: number;
  ap_ao_max?: number;
  
  // Doppler (Diastólica)
  vmax_ao_min?: number;
  vmax_ao_max?: number;
  vmax_pulm_min?: number;
  vmax_pulm_max?: number;
  mv_e_min?: number;
  mv_e_max?: number;
  mv_a_min?: number;
  mv_a_max?: number;
  mv_ea_min?: number;
  mv_ea_max?: number;
  mv_dt_min?: number;
  mv_dt_max?: number;
  ivrt_min?: number;
  ivrt_max?: number;
  tdi_e_min?: number;
  tdi_e_max?: number;
  tdi_a_min?: number;
  tdi_a_max?: number;
  e_e_linha_min?: number;
  e_e_linha_max?: number;
  
  // Volumes
  edv_min?: number;
  edv_max?: number;
  esv_min?: number;
  esv_max?: number;
  sv_min?: number;
  sv_max?: number;
}

export interface ComparacaoMedida {
  nome: string;
  valor_medido: string;
  referencia_min: number;
  referencia_max: number;
  status: "normal" | "aumentado" | "diminuido" | "nao_avaliado";
  interpretacao: string;
  categoria: string;
}

export interface ReferenciaFormData {
  especie: "Canina" | "Felina";
  peso_kg: number;
  
  // Medidas estruturais (VE - Modo M)
  lvid_d_min?: number;
  lvid_d_max?: number;
  lvid_s_min?: number;
  lvid_s_max?: number;
  ivs_d_min?: number;
  ivs_d_max?: number;
  ivs_s_min?: number;
  ivs_s_max?: number;
  lvpw_d_min?: number;
  lvpw_d_max?: number;
  lvpw_s_min?: number;
  lvpw_s_max?: number;
  
  // Função
  fs_min?: number;
  fs_max?: number;
  ef_min?: number;
  ef_max?: number;
  tapse_min?: number;
  tapse_max?: number;
  mapse_min?: number;
  mapse_max?: number;
  
  // Vasos (Aorta e Átrio Esquerdo)
  ao_min?: number;
  ao_max?: number;
  la_min?: number;
  la_max?: number;
  la_ao_min?: number;
  la_ao_max?: number;
  
  // Artéria Pulmonar
  ap_min?: number;
  ap_max?: number;
  ap_ao_min?: number;
  ap_ao_max?: number;
  
  // Doppler (Diastólica)
  vmax_ao_min?: number;
  vmax_ao_max?: number;
  vmax_pulm_min?: number;
  vmax_pulm_max?: number;
  mv_e_min?: number;
  mv_e_max?: number;
  mv_a_min?: number;
  mv_a_max?: number;
  mv_ea_min?: number;
  mv_ea_max?: number;
  mv_dt_min?: number;
  mv_dt_max?: number;
  ivrt_min?: number;
  ivrt_max?: number;
  tdi_e_min?: number;
  tdi_e_max?: number;
  tdi_a_min?: number;
  tdi_a_max?: number;
  e_e_linha_min?: number;
  e_e_linha_max?: number;
  
  // Volumes
  edv_min?: number;
  edv_max?: number;
  esv_min?: number;
  esv_max?: number;
  sv_min?: number;
  sv_max?: number;
}
