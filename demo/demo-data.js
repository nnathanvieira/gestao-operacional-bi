/* Dados integralmente sinteticos para a demonstracao publica. */
window.DEMO_DATA = (() => {
  const sectors = ["M1", "M2", "COLA", "ACABAMENTO"];
  const machines = {
    M1: ["INJ-01", "INJ-02", "INJ-04"],
    M2: ["GRUPO ALFA", "GRUPO BETA"],
    COLA: ["COL-01", "COL-02"],
    ACABAMENTO: ["ACB-01", "ACB-03"]
  };
  const categories = ["COMPONENTE", "CONJUNTO", "ACABAMENTO", "EMBALAGEM"];
  const people = ["Ana Lima", "Bruno Reis", "Carla Souza", "Diego Alves", "Elisa Martins", "Fabio Costa"];
  const iso = day => `2026-06-${String(day).padStart(2, "0")}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const o = Array.from({ length: 36 }, (_, index) => {
    const sector = sectors[index % sectors.length];
    const machine = machines[sector][index % machines[sector].length];
    const planned = 7800 + (index % 7) * 1250;
    const produced = Math.round(planned * (0.68 + (index % 6) * 0.055));
    return {
      o: `OP-${String(26041 + index).padStart(5, "0")}`,
      s: sector,
      m: machine,
      i: `IT-${String(310 + index).padStart(4, "0")}`,
      it: categories[index % categories.length],
      id: `Item demonstrativo ${String(index + 1).padStart(2, "0")}`,
      md: sector === "M1" ? `ML-${11 + (index % 8)}` : "",
      os: index % 9 === 0 ? "PENDENTE" : "LIBERADA",
      dv: index % 11 === 0 ? "SEM_LANCAMENTO" : index % 7 === 0 ? "DIVERGENTE" : "OK",
      pl: planned,
      sys: produced + (index % 5 === 0 ? 180 : 0),
      off: index % 11 === 0 ? 0 : produced
    };
  });

  const p = [];
  for (let day = 1; day <= 30; day += 1) {
    sectors.forEach((sector, sIndex) => {
      const order = o[(day * 3 + sIndex * 5) % o.length];
      const resource = machines[sector][day % machines[sector].length];
      const quantity = 1250 + ((day * 347 + sIndex * 811) % 1900);
      p.push({ d: iso(day), s: sector, m: resource, t: `${1 + (day % 3)}º TURNO`, o: order.o, q: quantity, h: 7.2 + (day % 4) * 0.2, n: 1 + (day % 3) });
    });
  }

  const c = [];
  sectors.forEach((sector, sIndex) => machines[sector].forEach((machine, mIndex) => {
    ["1º TURNO", "2º TURNO", "3º TURNO"].forEach((turn, tIndex) => {
      const available = 152 + ((sIndex + mIndex + tIndex) % 4) * 12;
      const productive = available * (0.71 + ((mIndex + tIndex) % 4) * 0.055);
      c.push({ s: sector, m: machine, t: turn, rs: productive / available > 0.83 ? "ADEQUADO" : "ATENCAO", hd: available, hp: productive, hstop: available * 0.075, hsu: available * 0.035, cap: available * (680 + sIndex * 85) });
    });
  }));

  const cd = [];
  const hw = [];
  for (let day = 1; day <= 30; day += 1) {
    sectors.forEach((sector, sIndex) => {
      const weekend = [0, 6].includes(new Date(`${iso(day)}T12:00:00`).getDay());
      const hd = weekend ? 16 : 48 + sIndex * 4;
      const hp = hd * (0.7 + ((day + sIndex) % 5) * 0.045);
      cd.push({ d: iso(day), s: sector, hd, hp, hstop: hd * (0.045 + (day % 4) * 0.01), hsu: hd * 0.025, cap: hd * (650 + sIndex * 90) });
      hw.push({ d: iso(day), s: sector, h: hd });
    });
  }

  const tr = sectors.flatMap((sector, sIndex) => machines[sector].flatMap((resource, rIndex) =>
    ["1º TURNO", "2º TURNO", "3º TURNO"].map((turn, tIndex) => ({
      s: sector, r: resource, rt: sector === "M2" ? "PESSOA" : "MAQUINA", t: turn,
      work: (rIndex + tIndex) % 4 === 3 ? "NAO" : "SIM", h: 118 + sIndex * 9 + tIndex * 14
    }))
  ));

  const m = Array.from({ length: 24 }, (_, index) => {
    const sector = sectors[index % sectors.length];
    return {
      d: iso(2 + (index % 27)), s: sector, m: machines[sector][index % machines[sector].length],
      mt: index % 3 === 0 ? "CORRETIVA" : index % 3 === 1 ? "PREVENTIVA" : "AJUSTE",
      mtd: index % 2 ? "MECANICA" : "ELETRICA",
      sym: ["Oscilacao de temperatura", "Falha no sensor de seguranca", "Desgaste no conjunto de tracao", "Ajuste de pressao"][index % 4],
      om: "", cnt: 1 + (index % 2), h: 1.4 + (index % 6) * 0.75, resp: 0.4 + (index % 3) * 0.3, exec: 1 + (index % 5) * 0.55
    };
  });

  const g = [];
  const gd = [];
  for (let day = 1; day <= 30; day += 2) {
    people.forEach((person, index) => {
      const group = index < 3 ? "GRUPO ALFA" : "GRUPO BETA";
      const quantity = 940 + ((day * 91 + index * 173) % 720);
      const target = 1280 + (index % 3) * 90;
      g.push({ d: iso(day), s: "M2", m: group, t: `${1 + (index % 2)}º TURNO`, i: `IT-${340 + index}`, it: categories[index % categories.length], g: group, e: person, at: "RATEIO_GRUPO", ph: 180, q: quantity, h: 7.5, meta: target });
      gd.push({ d: iso(day), s: "M2", g: group, e: person, q: quantity, meta: target });
    });
  }

  const u = people.slice(0, 4).map((person, index) => ({ d: iso(6 + index * 5), s: "M2", t: `${1 + (index % 2)}º TURNO`, e: person, h: 4 + index }));
  const r = sectors.flatMap((sector, sIndex) => machines[sector].map((machine, index) => {
    const hd = 430 + sIndex * 35;
    const hn = 320 + index * 44 + sIndex * 18;
    const planned = 128000 + sIndex * 31000 + index * 17000;
    const produced = planned * (0.72 + ((sIndex + index) % 4) * 0.06);
    return { s: sector, m: machine, hd, hn, cap: hd * (650 + sIndex * 80), pl: planned, prod: produced, saldo: planned - produced, pct: produced / planned, hidle: Math.max(hd - hn, 0), pidle: Math.max(planned - produced, 0), ocup: hn / hd, rs: hn / hd > 0.9 ? "CRITICO" : hn / hd > 0.78 ? "ATENCAO" : "ADEQUADO" };
  }));

  const monthNames = ["Julho 2025", "Agosto 2025", "Setembro 2025", "Outubro 2025", "Novembro 2025", "Dezembro 2025", "Janeiro 2026", "Fevereiro 2026", "Marco 2026", "Abril 2026", "Maio 2026", "Junho 2026"];
  const ms = monthNames.flatMap((label, monthIndex) => sectors.map((sector, sIndex) => {
    const year = monthIndex < 6 ? 2025 : 2026;
    const month = ((monthIndex + 6) % 12) + 1;
    const planned = 155000 + sIndex * 29000 + monthIndex * 5200;
    const percentage = clamp(0.73 + monthIndex * 0.017 + sIndex * 0.014, 0, 1.03);
    return { d: `${year}-${String(month).padStart(2, "0")}-01`, mo: `${year}-${String(month).padStart(2, "0")}`, lab: label, s: sector, hp: 980 + sIndex * 110 + monthIndex * 24, he: 74 + sIndex * 9 + monthIndex * 3, ht: 1160 + sIndex * 120 + monthIndex * 28, func: 31 + sIndex * 6 + (monthIndex % 3), pl: planned, prod: planned * percentage, np: Math.max(planned * (1 - percentage), 0), pct: percentage };
  }));

  const a = Array.from({ length: 18 }, (_, index) => {
    const sector = sectors[index % sectors.length];
    return { d: iso(3 + (index % 26)), s: sector, m: machines[sector][index % machines[sector].length], o: o[index].o, i: o[index].i, typ: ["META_NAO_IDENTIFICADA", "SETOR_DIVERGENTE", "DURACAO_INVALIDA", "QUANTIDADE_INVALIDA"][index % 4], sev: index % 5 === 0 ? "CRITICA" : index % 3 === 0 ? "ATENCAO" : "INFORMATIVA", base: index % 2 ? "PRODUCAO" : "ORDENS", col: index % 2 ? "META" : "SETOR", act: "Validar o cadastro e reconciliar a ordem antes do fechamento." };
  });

  return {
    p, o, c, r, ms, cd, hw, tr, m, g, gd, u, a,
    meta: {
      updated: "2026-06-30 18:00", prodRows: p.length, orderRows: o.length, maintRows: m.length, groupRows: g.length,
      qOff: p.reduce((sum, row) => sum + row.q, 0), qSys: o.reduce((sum, row) => sum + row.sys, 0), plan: o.reduce((sum, row) => sum + row.pl, 0),
      hExec: p.reduce((sum, row) => sum + row.h, 0), hAvail: c.reduce((sum, row) => sum + row.hd, 0), hProd: c.reduce((sum, row) => sum + row.hp, 0),
      hMaint: m.reduce((sum, row) => sum + row.h, 0), hSetup: c.reduce((sum, row) => sum + row.hsu, 0), capacity: c.reduce((sum, row) => sum + row.cap, 0),
      people: people.length, personQ: g.reduce((sum, row) => sum + row.q, 0), personMeta: g.reduce((sum, row) => sum + row.meta, 0), alerts: a.length,
      maintCount: m.reduce((sum, row) => sum + row.cnt, 0), hoursAbsent: u.reduce((sum, row) => sum + row.h, 0), hoursIdle: r.reduce((sum, row) => sum + row.hidle, 0),
      execHoursPct: 0.824, expectedToday: 0.967, idlePct: 0.142, idlePieces: r.reduce((sum, row) => sum + row.pidle, 0), refugo: false
    }
  };
})();
