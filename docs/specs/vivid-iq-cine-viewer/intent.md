# Intent - vivid-iq-cine-viewer

Data: 2026-08-02
Responsavel: Codex
Status: done

## 1) Problema atual

Exames salvos pelo GE Vivid iq podem chegar como arquivos DICOM sem extensao. A
imagem estatica esta no `Pixel Data` padrao, mas o cine 2D fica em elementos
privados `GEMS_Ultrasound_MovieGroup_001`, que nao sao reproduzidos pelos
visualizadores DICOM web genericos usados como referencia pelo produto.

## 2) Objetivo

Disponibilizar no FortCordis um visualizador local e autenticado capaz de abrir
o cine 2D desses arquivos, reproduzir a sequencia temporal e navegar quadro a
quadro sem enviar o DICOM ou seus metadados identificaveis ao servidor.

## 3) Nao objetivos

- Extrair ou exibir identificacao do paciente presente no DICOM.
- Armazenar o arquivo no FortCordis.
- Realizar medidas de distancia, area, velocidade ou tempo clinico.
- Reconstruir tracados, anotacoes ou volumes 3D privados da GE.
- Alterar ou preencher automaticamente um laudo.

## 4) Contexto e restricoes

- O arquivo clinico de calibracao permanece fora do repositorio.
- A primeira entrega suporta DICOM Part 10 em Explicit VR Little Endian com o
  criador privado `GEMS_Ultrasound_MovieGroup_001` e cine 2D em blocos GE.
- O navegador precisa manter o exame apenas em memoria local durante a sessao.
- A escala espacial do leitor aberto de referencia ainda nao e confiavel; a
  interface deve proibir interpretacao metrologica.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica autenticada.
- Modulos impactados: menu do dashboard e nova pagina de visualizacao.
- Risco de regressao: baixo, pois nao ha API, banco ou contrato de laudo.

## 6) Riscos iniciais

- Firmware futuro pode alterar os elementos privados da GE.
- Arquivos grandes podem pressionar a memoria de dispositivos moveis.
- O cine extraido pode nao conter tracados ou sobreposicoes salvos em outra
  estrutura privada.

## 7) Perguntas abertas

- Quais outras versoes de firmware do Vivid iq precisam ser homologadas?
- Em uma fase futura, os quadros selecionados serao vinculados ao laudo?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
