// ============================================================
// CAREPATH — CAMADA DE SERVIÇOS (services.js)
// ============================================================
//
// Centraliza TODAS as chamadas externas (ML + Firebase/Twilio).
//
// COMO FUNCIONA:
// - Enquanto DEMO_MODE = true, tudo funciona com dados simulados
//   (não precisa de Firebase nem ML a correr).
// - Quando tiver os serviços prontos:
//     1. Meta os URLs em CONFIG (abaixo)
//     2. Mude DEMO_MODE para false
//   ...e a app passa a usar os serviços reais. Mais nada muda.
// ============================================================

// ------------------------------------------------------------
// CONFIGURAÇÃO — editar quando os serviços estiverem prontos
// ------------------------------------------------------------
export const DEMO_MODE = true; // ← mude para false quando ligar os serviços

const CONFIG = {
  // URL base das Firebase Cloud Functions
  // Ex.: https://us-central1-carepath.cloudfunctions.net
  FIREBASE_URL: 'https://SEU-PROJETO.cloudfunctions.net',

  // URL do modelo de ML (Flask). Ex.: http://192.168.1.100:5000
  ML_URL: 'http://localhost:5000',
};

// Pequeno atraso para simular rede em modo demo
const fakeDelay = (ms = 900) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// 1. AVALIAÇÃO DE RISCO (Machine Learning)
// ============================================================
//
// Recebe: { spo2, mmrc, cat, idade?, adesao?, internamentos? }
// Devolve: { nivel: 0|1|2, texto, mensagem, confianca }
// ------------------------------------------------------------

const RISK_TEXTS = ['Risco Baixo', 'Risco Médio', 'Risco Alto'];
const RISK_MSGS = [
  'Situação estável. Manter acompanhamento de rotina.',
  'Requer monitorização atenta nos próximos dias.',
  'Contacte a equipa médica com urgência.',
];

export async function avaliarRisco({ spo2, mmrc, cat, idade, adesao, internamentos }) {
  // ----- MODO DEMO: regra simples local -----
  if (DEMO_MODE) {
    await fakeDelay();
    let score = 0;
    if (parseInt(spo2, 10) < 88) score += 2;
    if (parseInt(mmrc, 10) > 3) score += 1;
    if (parseInt(cat, 10) > 30) score += 1;
    const nivel = Math.min(2, score);
    return {
      nivel,
      texto: RISK_TEXTS[nivel],
      mensagem: RISK_MSGS[nivel],
      confianca: 75 + Math.floor(Math.random() * 20),
    };
  }

  // ----- MODO REAL: chama o modelo Python (Flask) -----
  const resposta = await fetch(`${CONFIG.ML_URL}/prever`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spo2: Number(spo2),
      mmrc: Number(mmrc),
      cat: Number(cat),
      idade: Number(idade) || 65,
      adesao_medicacao: Number(adesao) || 80,
      dias_internamento_ano: Number(internamentos) || 0,
    }),
  });

  if (!resposta.ok) throw new Error('Erro no modelo de ML');
  const dados = await resposta.json();
  const nivel = dados.nivel_risco ?? 0;

  return {
    nivel,
    texto: RISK_TEXTS[nivel],
    mensagem: RISK_MSGS[nivel],
    confianca: Math.round((dados.probabilidade ?? 0.8) * 100),
  };
}

// ============================================================
// 2. ENVIAR SMS (Firebase + Twilio)
// ============================================================
//
// Recebe: { telefone, mensagem, pacienteId? }
// Devolve: { sucesso, sid }
// ------------------------------------------------------------

export async function enviarSMS({ telefone, mensagem, pacienteId }) {
  if (DEMO_MODE) {
    await fakeDelay();
    return { sucesso: true, sid: 'DEMO_' + Date.now() };
  }

  const resposta = await fetch(`${CONFIG.FIREBASE_URL}/enviarSMS`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone, mensagem, pacienteId }),
  });

  if (!resposta.ok) throw new Error('Erro ao enviar SMS');
  return resposta.json();
}

// ============================================================
// 3. ENVIAR LEMBRETE DE CONSULTA
// ============================================================

export async function enviarLembrete({ telefone, nome, data, hora, medico }) {
  if (DEMO_MODE) {
    await fakeDelay();
    return { sucesso: true, sid: 'DEMO_' + Date.now() };
  }

  const resposta = await fetch(`${CONFIG.FIREBASE_URL}/enviarLembreteConsulta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone, nome, data, hora, medico }),
  });

  if (!resposta.ok) throw new Error('Erro ao enviar lembrete');
  return resposta.json();
}

// ============================================================
// 4. ENVIAR ALERTA DE RISCO
// ============================================================

export async function enviarAlertaRisco({ telefone, nome, nivelRisco, spo2 }) {
  if (DEMO_MODE) {
    await fakeDelay();
    return { sucesso: true, sid: 'DEMO_' + Date.now() };
  }

  const resposta = await fetch(`${CONFIG.FIREBASE_URL}/enviarAlertaRisco`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone, nome, nivelRisco, spo2 }),
  });

  if (!resposta.ok) throw new Error('Erro ao enviar alerta');
  return resposta.json();
}

// ============================================================
// 5. FAZER CHAMADA DE VOZ (Firebase + Twilio)
// ============================================================
//
// Recebe: { telefone, mensagem?, nome? }
// Devolve: { sucesso, sid }
// A Twilio liga ao número e "fala" a mensagem em português.
// ------------------------------------------------------------

export async function fazerChamada({ telefone, mensagem, nome }) {
  if (DEMO_MODE) {
    await fakeDelay();
    return { sucesso: true, sid: 'DEMO_CALL_' + Date.now() };
  }

  const resposta = await fetch(`${CONFIG.FIREBASE_URL}/fazerChamada`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefone, mensagem, nome }),
  });

  if (!resposta.ok) throw new Error('Erro ao fazer chamada');
  return resposta.json();
}

// ============================================================
// 6. LISTAR SMS ENVIADOS (para dashboard)
// ============================================================

const SMS_DEMO = [
  { id: '1', telefone: '+351912000001', mensagem: 'Lembrete de consulta amanhã às 10h', estado: 'entregue' },
  { id: '2', telefone: '+351912000002', mensagem: 'Alerta: SpO2 baixo detetado', estado: 'entregue' },
  { id: '3', telefone: '+351912000003', mensagem: 'Confirmação de consulta recebida', estado: 'entregue' },
];

export async function listarSMS() {
  if (DEMO_MODE) {
    await fakeDelay(500);
    return { sucesso: true, total: SMS_DEMO.length, sms: SMS_DEMO };
  }

  const resposta = await fetch(`${CONFIG.FIREBASE_URL}/listarSMS`);
  if (!resposta.ok) throw new Error('Erro ao listar SMS');
  return resposta.json();
}
