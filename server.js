const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const API_KEY = 'SUA_CHAVE_SECRETA_AQUI';

const perguntas = [
  {
    id: 1,
    categoria: 'Geral',
    pergunta: 'Qual é a capital do Brasil?',
    opcoes: ['Rio de Janeiro', 'Brasília', 'São Paulo'],
    resposta: 'Brasília',
  },
  {
    id: 2,
    categoria: 'Ciência',
    pergunta: 'Quantos planetas há no sistema solar?',
    opcoes: ['7', '8', '9'],
    resposta: '8',
  },
];

app.use((req, res, next) => {
  const chave = req.headers['x-api-key'];
  if (chave && chave === API_KEY) {
    next();
  } else {
    res.status(403).json({ erro: 'Chave inválida' });
  }
});

app.get('/perguntas', (req, res) => {
  res.json(perguntas);
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
