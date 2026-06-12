// ============================================================
// CAREPATH — MOTOR DE DECISÃO DA AGENDA INTELIGENTE
// Ficheiro: motorDecisao.js
// ============================================================
//
// Decide o que fazer com a consulta de um paciente depois da
// triagem, conforme o risco. As REGRAS estão separadas em cima
// para a equipa clínica poder ajustar sem mexer na lógica.
//
// Níveis de autonomia (do menos para o mais autónomo):
//   'manter'     → nada muda, só lembrete normal
//   'sugerir'    → app propõe antecipar, HUMANO confirma
//   'automatico' → app antecipa já e notifica todos
// ============================================================

// ------------------------------------------------------------
// REGRAS CONFIGURÁVEIS (definidas pela equipa clínica)
// ------------------------------------------------------------
export const REGRAS = {
  // Limiares clínicos
  spo2Critico: 88,      // SpO2 abaixo disto → ação automática (afinado: mais sensível)
  spo2Atencao: 92,      // SpO2 abaixo disto conta como sinal de risco
  mmrcAlto: 3,          // mMRC acima disto conta como sinal de risco
  catAlto: 30,          // CAT acima disto conta como sinal de risco

  // Quantos sinais de risco fazem um "risco moderado"
  sinaisParaModerado: 2,

  // Interruptores (ligar/desligar comportamentos)
  lembretesAutomaticos: true,
  sugerirAntecipacao: true,
  anteciparAutomaticamente: true,

  // Trava de segurança: nº máximo de dias que a app antecipa
  // sozinha. Acima disto, fica sempre para o médico.
  maxDiasAutoAntecipacao: 7,   // afinado: trava mais apertada
};

// ------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// ------------------------------------------------------------
//
// Entrada:
//   dados = {
//     spo2, mmrc, cat,            // valores da triagem
//     nivelRisco,                 // 0|1|2 vindo do ML
//     diasAteConsulta,            // dias até à consulta marcada
//   }
//
// Saída:
//   {
//     decisao,        // 'manter' | 'sugerir' | 'automatico'
//     gravidade,      // 'baixo' | 'moderado' | 'critico'
//     acoes,          // lista de ações a executar
//     justificacao,   // texto explicativo (auditável)
//   }
// ------------------------------------------------------------
export function decidirAgendamento(dados) {
  const { spo2, mmrc, cat, nivelRisco = 0, diasAteConsulta = 0 } = dados;

  const s = Number(spo2);
  const m = Number(mmrc);
  const c = Number(cat);

  // 1) Contar sinais de risco
  let sinais = 0;
  const motivos = [];
  if (s < REGRAS.spo2Atencao) { sinais++; motivos.push(`SpO2 ${s}%`); }
  if (m > REGRAS.mmrcAlto) { sinais++; motivos.push(`mMRC ${m}`); }
  if (c > REGRAS.catAlto) { sinais++; motivos.push(`CAT ${c}`); }

  // 2) Classificar gravidade
  let gravidade;
  if (s < REGRAS.spo2Critico) {
    gravidade = 'critico';            // SpO2 crítico domina tudo
  } else if (sinais >= REGRAS.sinaisParaModerado || nivelRisco >= 2) {
    gravidade = 'moderado';
  } else {
    gravidade = 'baixo';
  }

  // 3) Decidir ação conforme gravidade + regras ligadas
  let decisao = 'manter';
  const acoes = [];

  if (gravidade === 'critico' && REGRAS.anteciparAutomaticamente) {
    // Trava de segurança: só auto-antecipa dentro do limite de dias
    if (diasAteConsulta <= REGRAS.maxDiasAutoAntecipacao) {
      decisao = 'automatico';
      acoes.push('antecipar_consulta', 'notificar_paciente_sms',
                 'notificar_paciente_chamada', 'notificar_profissional');
    } else {
      // Caso fora do limite → não decide sozinha, escala ao médico
      decisao = 'sugerir';
      acoes.push('alertar_profissional_urgente');
    }
  } else if (gravidade === 'moderado' && REGRAS.sugerirAntecipacao) {
    decisao = 'sugerir';
    acoes.push('sugerir_antecipacao_ao_profissional');
  } else {
    decisao = 'manter';
    if (REGRAS.lembretesAutomaticos) acoes.push('enviar_lembrete_normal');
  }

  // 4) Justificação auditável (importante para registo clínico/RGPD)
  const justificacao =
    motivos.length > 0
      ? `Gravidade ${gravidade} — sinais: ${motivos.join(', ')}.`
      : `Gravidade ${gravidade} — sem sinais de risco relevantes.`;

  return { decisao, gravidade, acoes, justificacao };
}

// ------------------------------------------------------------
// TEXTOS para mostrar ao utilizador (mapeia decisão → UI)
// ------------------------------------------------------------
export const DECISAO_UI = {
  manter: {
    titulo: 'Consulta mantida',
    cor: '#27A679',
    descricao: 'Sem necessidade de antecipar. Lembrete normal agendado.',
  },
  sugerir: {
    titulo: 'Antecipação sugerida',
    cor: '#F39C12',
    descricao: 'A app recomenda antecipar. Aguarda confirmação do profissional.',
  },
  automatico: {
    titulo: 'Consulta antecipada automaticamente',
    cor: '#E55353',
    descricao: 'Risco crítico. Consulta antecipada e paciente notificado.',
  },
};
