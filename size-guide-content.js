/**
 * AZAVISION — Guia de tamanhos T-shirts (FR · PT · EN · ES)
 * Medidas em centímetros (cm) — padrão em Portugal.
 */
(function (global) {
  'use strict';

  var rows = [
    { size: 'XXS', chest: '78–82', length: '64', shoulder: '38' },
    { size: 'XS', chest: '82–86', length: '66', shoulder: '40' },
    { size: 'S', chest: '86–90', length: '68', shoulder: '42' },
    { size: 'M', chest: '90–94', length: '70', shoulder: '44' },
    { size: 'L', chest: '94–98', length: '72', shoulder: '46' },
    { size: 'XL', chest: '98–102', length: '74', shoulder: '48' },
    { size: 'XXL', chest: '102–106', length: '76', shoulder: '50' },
    { size: '3XL', chest: '106–110', length: '78', shoulder: '52' }
  ];

  global.SizeGuideContent = {
    pt: {
      title: 'Guia de tamanhos — T-shirts',
      subtitle: 'Todas as medidas estão em centímetros (cm), como é habitual em Portugal.',
      howToTitle: 'Como escolher o tamanho certo',
      steps: [
        'Meça o contorno do peito: fita métrica à volta da parte mais larga do tórax, de pé e relaxado, sem apertar.',
        'Compare o valor obtido com a coluna « Peito (corpo) » da tabela — escolha o tamanho em que a sua medida se encaixa.',
        'Comprimento e ombros referem-se à peça já confecionada (medida à plano, de ombro a ombro ou do ombro à barra).'
      ],
      cols: ['Tamanho', 'Peito (corpo)', 'Comprimento', 'Ombros'],
      colHint: 'Peito (corpo) = contorno do seu tórax · Comprimento e Ombros = medidas da t-shirt',
      unit: 'cm',
      tip: 'Entre dois tamanhos? Escolha o maior para maior conforto. Corte regular unissexo.',
      note: 'Valores orientativos. Pode existir uma tolerância de ±2 cm entre lotes. Tamanho único (TU): peito até ~100 cm.',
      oneSize: 'Tamanho único (TU): indicado para peito até cerca de 100 cm e comprimento ~72 cm.'
    },
    fr: {
      title: 'Guide des tailles — T-shirts',
      subtitle: 'Toutes les mesures sont en centimètres (cm).',
      howToTitle: 'Comment choisir votre taille',
      steps: [
        'Mesurez votre tour de poitrine : mètre ruban autour de la partie la plus large, debout, sans serrer.',
        'Comparez avec la colonne « Poitrine (corps) » et choisissez la taille correspondante.',
        'Longueur et épaules : mesures du vêtement à plat (épaule à épaule, ou épaule au bas).'
      ],
      cols: ['Taille', 'Poitrine (corps)', 'Longueur', 'Épaules'],
      colHint: 'Poitrine = votre tour de poitrine · Longueur & Épaules = mesures du t-shirt',
      unit: 'cm',
      tip: 'Entre deux tailles ? Prenez la plus grande pour plus de confort. Coupe regular unisexe.',
      note: 'Mesures indicatives. Tolérance possible de ±2 cm. Taille unique (TU) : poitrine jusqu\'à ~100 cm.',
      oneSize: 'Taille unique (TU) : poitrine jusqu\'à ~100 cm, longueur ~72 cm.'
    },
    en: {
      title: 'Size guide — T-shirts',
      subtitle: 'All measurements are in centimetres (cm).',
      howToTitle: 'How to pick your size',
      steps: [
        'Measure your chest: tape around the widest part of your torso, standing relaxed — do not pull tight.',
        'Match your measurement to the « Chest (body) » column and select that size.',
        'Length and shoulders are garment measurements (flat lay: shoulder to shoulder, or shoulder to hem).'
      ],
      cols: ['Size', 'Chest (body)', 'Length', 'Shoulders'],
      colHint: 'Chest = your body measurement · Length & Shoulders = t-shirt measurements',
      unit: 'cm',
      tip: 'Between two sizes? Choose the larger for a more comfortable fit. Regular unisex cut.',
      note: 'Guide values only. ±2 cm tolerance between batches. One size (TU): chest up to ~100 cm.',
      oneSize: 'One size (TU): suitable for chest up to ~100 cm, length ~72 cm.'
    },
    es: {
      title: 'Guía de tallas — Camisetas',
      subtitle: 'Todas las medidas están en centímetros (cm).',
      howToTitle: 'Cómo elegir tu talla',
      steps: [
        'Mide el contorno del pecho: cinta métrica alrededor de la parte más ancha, de pie y relajado, sin apretar.',
        'Compara con la columna « Pecho (cuerpo) » y elige la talla que corresponda.',
        'Largo y hombros: medidas de la prenda extendida (hombro a hombro, o hombro al bajo).'
      ],
      cols: ['Talla', 'Pecho (cuerpo)', 'Largo', 'Hombros'],
      colHint: 'Pecho = tu contorno · Largo y Hombros = medidas de la camiseta',
      unit: 'cm',
      tip: '¿Entre dos tallas? Elige la mayor para más comodidad. Corte regular unisex.',
      note: 'Medidas orientativas. Tolerancia de ±2 cm. Talla única (TU): pecho hasta ~100 cm.',
      oneSize: 'Talla única (TU): pecho hasta ~100 cm, largo ~72 cm.'
    },
    rows: rows
  };
})(typeof window !== 'undefined' ? window : this);
