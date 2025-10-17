const express = require('express');
const cors = require('cors');
const fs = require('fs');
const readline = require('readline');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const API_KEY = 'SUA_CHAVE_SECRETA_AQUI';
const ARQUIVO_PERGUNTAS = './perguntas.json';

// Middleware de autenticação
app.use((req, res, next) => {
  const chave = req.headers['x-api-key'];
  if (chave && chave === API_KEY) next();
  else res.status(403).json({ erro: 'Chave inválida' });
});

// Ler perguntas do arquivo (uma linha por pergunta)
async function lerPerguntas() {
  const perguntas = [];
  if (!fs.existsSync(ARQUIVO_PERGUNTAS)) return perguntas;
  const fileStream = fs.createReadStream(ARQUIVO_PERGUNTAS);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) perguntas.push(JSON.parse(line));
  }
  return perguntas;
}

// GET /perguntas
app.get('/perguntas', async (req, res) => {
  const perguntas = await lerPerguntas();
  res.json(perguntas);
});

// POST /perguntas
app.post('/perguntas', async (req, res) => {
  const { categoria, pergunta, opcoes, resposta } = req.body;
  if (!categoria || !pergunta || !opcoes || !resposta) {
    return res.status(400).json({ erro: 'Campos inválidos' });
  }
  const perguntas = await lerPerguntas();
  const novaPergunta = {
    id: perguntas.length + 1,
    categoria,
    pergunta,
    opcoes,
    resposta,
  };
  fs.appendFileSync(ARQUIVO_PERGUNTAS, JSON.stringify(novaPergunta) + '\n');
  res.status(201).json(novaPergunta);
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
