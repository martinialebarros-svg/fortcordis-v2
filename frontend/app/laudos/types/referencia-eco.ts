export interface ReferenciaEco {
  id: number;
  especie: "canino" | "felino";
  peso_kg: number;
  
  // Medidas estruturais
  lvidd_min?: number;
  lvidd_max?: number;
  lvids_min?: number;
  lvids_max?: number;
  ivsd_min?: number;
  ivsd_max?: number;
  ivss_min?: number;
  ivss_max?: number;
  lvpwd_min?: number;
  lvpwd_max?: number;
  lvpws_min?: number;
  lvpws_max?: number;
  
  // Função
  fs_min?: number;
  fs_max?: number;
  ef_min?: number;
  ef_max?: number;
  
  // Vasos
  ao_min?: number;
  ao_max?: number;
  la_min?: number;
  la_max?: number;
  la_ao_min?: number;
  la_ao_max?: number;
  
  // Doppler
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
  
  // Volumes (caninos)
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
  especie: "canino" | "felino";
  peso_kg: number;
  
  // Medidas estruturais
  lvidd_min?: number;
  lvidd_max?: number;
  lvids_min?: number;
  lvids_max?: number;
  ivsd_min?: number;
  ivsd_max?: number;
  ivss_min?: number;
  ivss_max?: number;
  lvpwd_min?: number;
  lvpwd_max?: number;
  lvpws_min?: number;
  lvpws_max?: number;
  
  // Função
  fs_min?: number;
  fs_max?: number;
  ef_min?: number;
  ef_max?: number;
  
  // Vasos
  ao_min?: number;
  ao_max?: number;
  la_min?: number;
  la_max?: number;
  la_ao_min?: number;
  la_ao_max?: number;
  
  // Doppler
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
  
  // Volumes (caninos)
  edv_min?: number;
  edv_max?: number;
  esv_min?: number;
  esv_max?: number;
  sv_min?: number;
  sv_max?: number;
}
