// Demo data (fictional). Replace with your own through the app UI.
// All names, amounts and accounts below are made up for demonstration only.

let _id = 0;
const item = (valor, descricao, conta = "", parcela = "", pago = false) => ({
  id: "i" + (++_id) + "_" + Math.random().toString(36).slice(2, 7),
  valor,
  descricao,
  conta,
  parcela,
  pago,
});

// Items paid from the income received on day 5
const cycle5 = [
  item(1200.0, "ALUGUEL"),
  item(450.0, "MERCADO"),
  item(90.0, "AGUA"),
  item(180.0, "LUZ"),
  item(250.0, "COMBUSTIVEL"),
  item(110.0, "INTERNET"),
  item(40.0, "TELEFONE"),
  item(120.0, "SEGURO"),
  item(39.9, "STREAMING", "CARTAO A"),
  item(300.0, "VIAGEM", "CARTAO A", "3/12"),
  item(180.0, "DENTISTA", "CARTAO A", "2/6"),
  item(95.5, "NOTEBOOK", "CARTAO A", "5/10"),
  item(60.0, "FARMACIA", "CARTAO A", "1/2"),
];

// Items paid from the income received on day 20
const cycle20 = [
  item(25.0, "MUSICA", "CARTAO B"),
  item(300.0, "CARRO", "", "10/60"),
  item(100.0, "LAZER"),
  item(80.0, "PRESENTES"),
  item(70.0, "ACADEMIA", "CARTAO B"),
  item(55.9, "ROUPAS", "CARTAO C", "2/5"),
  item(120.0, "ELETRODOMESTICO", "CARTAO C", "1/8"),
  item(45.0, "LIVROS", "CARTAO B", "3/3"),
];

// Planned monthly budget by category
const budget = [
  { categoria: "ALUGUEL", valor: 1200 },
  { categoria: "ALIMENTACAO", valor: 450 },
  { categoria: "AGUA", valor: 100 },
  { categoria: "LUZ", valor: 200 },
  { categoria: "TRANSPORTE", valor: 400 },
  { categoria: "INTERNET", valor: 110 },
  { categoria: "TELEFONE", valor: 40 },
  { categoria: "SEGURO", valor: 120 },
  { categoria: "ASSINATURAS", valor: 65 },
  { categoria: "CARRO", valor: 300 },
  { categoria: "ACADEMIA", valor: 70 },
  { categoria: "RESERVA", valor: 400 },
  { categoria: "INVESTIMENTOS", valor: 200 },
  { categoria: "VIAGENS", valor: 300 },
  { categoria: "LAZER", valor: 100 },
  { categoria: "PRESENTES", valor: 80 },
];

function seedData() {
  return {
    contas: ["CARTAO A", "CARTAO B", "CARTAO C"],
    budget,
    months: {
      "2026-07": {
        cycle5: { renda: 4000.0, itens: cycle5 },
        cycle20: { renda: 1500.0, itens: cycle20 },
      },
    },
  };
}

module.exports = { seedData };
