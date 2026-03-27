const PERSONAS = [
  {
    id: "ung-mann",
    name: "Ung mann",
    description: "25 år, frisk, ingen medisiner, aktiv livsstil",
    traits: {
      gender: "Mann",
      age: 25,
      smoker: false,
      alcohol: "0-5",
      medications: false,
      allergies: false,
      previousConditions: false,
      exercise: "3-4",
      pregnant: false,
    },
  },
  {
    id: "gravid-kvinne",
    name: "Gravid kvinne",
    description: "32 år, frisk, førstegangsfødende, samboer, yrkesaktiv",
    traits: {
      gender: "Kvinne",
      age: 32,
      smoker: false,
      alcohol: "none",
      medications: false,
      allergies: false,
      previousConditions: false,
      exercise: "1-2",
      pregnant: true,
      firstPregnancy: true,
    },
  },
  {
    id: "eldre-kvinne",
    name: "Eldre kvinne",
    description: "68 år, overgangsalder, tar D-vitamin, lett vektnedgang",
    traits: {
      gender: "Kvinne",
      age: 68,
      smoker: false,
      alcohol: "0-5",
      medications: true,
      allergies: false,
      previousConditions: false,
      exercise: "1-2",
      pregnant: false,
      menopause: true,
    },
  },
  {
    id: "kronisk-syk",
    name: "Kronisk syk mann",
    description: "45 år, diabetes type 2, faste medisiner, røykt tidligere",
    traits: {
      gender: "Mann",
      age: 45,
      smoker: "previously",
      alcohol: "5-10",
      medications: true,
      allergies: true,
      previousConditions: true,
      exercise: "0",
      pregnant: false,
    },
  },
];

function getPersonas() {
  return PERSONAS;
}

function getPersonaById(id) {
  return PERSONAS.find((p) => p.id === id) || null;
}

function formatPersonaList() {
  const lines = PERSONAS.map(
    (p, i) => `  ${i + 1}. ${p.name} — ${p.description}`,
  );
  lines.push(`  ${PERSONAS.length + 1}. Noen — tilfeldig / nøytrale svar`);
  lines.push(`  ${PERSONAS.length + 2}. Lag egen — beskriv persona selv`);
  return lines.join("\n");
}

module.exports = {
  PERSONAS,
  getPersonas,
  getPersonaById,
  formatPersonaList,
};
