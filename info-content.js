/**
 * AZAVISION — Contenus informatifs (FR · PT · EN · ES)
 * Placeholders : {{storeName}}, {{email}}, {{country}}
 */
(function (global) {
  'use strict';

  function sec(h, p) {
    return { h: h, p: Array.isArray(p) ? p : [p] };
  }

  var returnsPt = {
    title: 'Trocas & Devoluções',
    promise: '✦ Compromisso AZAVISION — 30 dias para decidir com tranquilidade ✦',
    updated: 'Última atualização: 12 de junho de 2026',
    sections: [
      sec('A nossa filosofia', 'Na {{storeName}}, cada t-shirt, bolsa e acessório nasce no nosso atelier em {{country}}. Queremos que o amor pela peça seja partilhado — não a dúvida. Por isso, além do direito legal de livre resolução, oferecemos o Compromisso AZAVISION: 30 dias para trocar ou devolver, de forma simples e transparente.'),
      sec('Prazos legais e promessa AZAVISION', [
        'Direito legal (consumidor na UE): 14 dias após receber a encomenda, sem necessidade de justificação (Decreto-Lei n.º 24/2014).',
        'Compromisso AZAVISION: alargamos para 30 dias corridos a partir da data de entrega — mais tempo para experimentar em casa, com calma.',
        'Artigos em promoção ou saldo: mesmas condições, salvo indicação contrária na ficha do produto.'
      ]),
      sec('O que pode trocar ou devolver', [
        'T-shirts e vestuário AZAVISION (tamanhos e cores disponíveis na loja).',
        'Bolsas (« bolsas ») e acessórios da coleção, em estado de novo.',
        'Apenas artigos não personalizados, sem sinais de uso, com etiquetas e embalagem original sempre que possível.'
      ]),
      sec('O que não aceitamos', [
        'Peças usadas, lavadas, alteradas ou com odores.',
        'Artigos personalizados ou feitos por encomenda especial.',
        'Acessórios de higiene íntima ou embalagens abertas que comprometam a revenda.',
        'Pedidos fora do prazo de 30 dias (ou 14 dias legais se optar apenas pelo direito de livre resolução).'
      ]),
      sec('Como pedir uma troca ou devolução — 4 passos', [
        '1. Contacte-nos em {{email}} com o assunto « Troca / Devolução » e indique o código da encomenda.',
        '2. Descreva o motivo (troca de tamanho, cor ou devolução) — ajudamo-lo a escolher a melhor solução.',
        '3. Envie a peça para o endereço que lhe indicarmos (Portugal), preferencialmente com o mesmo tipo de embalagem.',
        '4. Após receção e verificação no nosso atelier, processamos a troca ou o reembolso.'
      ]),
      sec('Trocas de tamanho ou cor', 'Prefere outro tamanho ou cor? Enviaremos a nova peça assim que recebermos a original (conforme stock). Se a peça desejada não estiver disponível, reembolsamos o valor pago. Sem complicações — é a forma AZAVISION de cuidar de si.'),
      sec('Reembolsos', [
        'Método: o mesmo utilizado na compra (cartão, MB Way, transferência, etc.), salvo acordo diferente.',
        'Prazo: até 14 dias após recebermos e confirmarmos o artigo devolvido.',
        'Portes de envio iniciais: não reembolsados, salvo artigo defeituoso ou erro nosso.',
        'Portes de devolução: por conta do cliente, exceto se a devolução for por nossa responsabilidade (defeito ou envio incorreto).'
      ]),
      sec('Artigos com defeito', 'Se receber um artigo com defeito de fabrico ou diferente do encomendado, contacte-nos de imediato com fotos. Assumimos a recolha ou o reenvio sem custo para si — é a nossa responsabilidade, não a sua.'),
      sec('Contacto dedicado', 'E-mail: {{email}} · Assunto: « Troca / Devolução » · Indique sempre o código da encomenda. Respondemos em português (Portugal) no prazo útil de 2 dias úteis.')
    ]
  };

  var returnsFr = {
    title: 'Échanges & retours',
    promise: '✦ Engagement AZAVISION — 30 jours pour décider sereinement ✦',
    updated: 'Dernière mise à jour : 12 juin 2026',
    sections: [
      sec('Notre philosophie', 'Chez {{storeName}}, chaque t-shirt, sac et accessoire est préparé au {{country}}. Droit légal de rétractation (14 jours UE) + promesse AZAVISION : 30 jours pour échanger ou retourner.'),
      sec('Délais', '14 jours légaux (UE) · 30 jours AZAVISION à compter de la livraison.'),
      sec('Éligible', 'Vêtements, sacs et accessoires AZAVISION non portés, non personnalisés, avec étiquettes.'),
      sec('Non éligible', 'Articles usés, personnalisés, ou hors délai.'),
      sec('Procédure en 4 étapes', '1. E-mail {{email}} — objet « Échange / Retour » + n° commande. 2. Nous vous guidons. 3. Renvoi au Portugal. 4. Échange ou remboursement après contrôle atelier.'),
      sec('Échange taille / couleur', 'Nouvelle pièce envoyée dès réception de l\'originale (selon stock). Sinon remboursement intégral.'),
      sec('Remboursements', 'Même moyen de paiement, sous 14 jours après réception. Frais de retour à votre charge sauf défaut ou erreur de notre part.'),
      sec('Défaut', 'Photos + contact immédiat : nous prenons en charge les frais.'),
      sec('Contact', '{{email}} — objet « Échange / Retour » + code commande.')
    ]
  };

  var returnsEn = {
    title: 'Exchanges & Returns',
    promise: '✦ The AZAVISION Promise — 30 days to decide with confidence ✦',
    updated: 'Last updated: 12 June 2026',
    sections: [
      sec('Our philosophy', 'At {{storeName}}, every t-shirt, bag and accessory is crafted with care in {{country}}. EU legal withdrawal: 14 days. AZAVISION Promise: 30 days to exchange or return.'),
      sec('Timeframes', '14 days legal (EU) · 30 days AZAVISION from delivery date.'),
      sec('Eligible items', 'AZAVISION apparel, bags and accessories — unworn, non-customised, with tags where possible.'),
      sec('Not eligible', 'Worn, customised items, or requests outside the 30-day window.'),
      sec('How to return — 4 steps', '1. Email {{email}} — subject « Exchange / Return » + order code. 2. We guide you. 3. Ship to the address we provide (Portugal). 4. Exchange or refund after atelier inspection.'),
      sec('Size / colour exchange', 'We ship the new item once we receive the original (stock permitting). Otherwise full refund.'),
      sec('Refunds', 'Same payment method within 14 days of receipt. Return shipping at customer cost unless defect or our error.'),
      sec('Defective items', 'Contact us immediately with photos — we cover return costs.'),
      sec('Contact', '{{email}} — subject « Exchange / Return » + order code.')
    ]
  };

  var returnsEs = {
    title: 'Cambios y devoluciones',
    promise: '✦ Compromiso AZAVISION — 30 días para decidir con tranquilidad ✦',
    updated: 'Última actualización: 12 de junio de 2026',
    sections: [
      sec('Nuestra filosofía', 'En {{storeName}}, cada camiseta, bolso y accesorio se prepara en {{country}}. Derecho legal UE: 14 días. Compromiso AZAVISION: 30 días para cambiar o devolver.'),
      sec('Plazos', '14 días legales (UE) · 30 días AZAVISION desde la entrega.'),
      sec('Qué se puede devolver', 'Ropa, bolsos y accesorios AZAVISION sin usar, no personalizados, con etiquetas.'),
      sec('Exclusiones', 'Artículos usados, personalizados o fuera de plazo.'),
      sec('Procedimiento — 4 pasos', '1. Email {{email}} — asunto « Cambio / Devolución » + código pedido. 2. Le orientamos. 3. Envío a Portugal. 4. Cambio o reembolso tras revisión.'),
      sec('Cambio de talla / color', 'Enviamos la nueva pieza al recibir la original (según stock). Si no hay stock, reembolso.'),
      sec('Reembolsos', 'Mismo método de pago en 14 días. Gastos de devolución a cargo del cliente salvo defecto o error nuestro.'),
      sec('Defectos', 'Contacto inmediato con fotos — nosotros asumimos los gastos.'),
      sec('Contacto', '{{email}} — asunto « Cambio / Devolución » + código pedido.')
    ]
  };

  var deliveryPt = {
    title: 'Prazos & Envio',
    updated: 'Última atualização: 12 de junho de 2026',
    sections: [
      sec('Onde enviamos', 'Portugal continental e ilhas, União Europeia e outros destinos quando disponível no checkout.'),
      sec('Transportadoras', 'DHL Express, CTT ou equivalente — rastreio enviado por e-mail após expedição.'),
      sec('Prazos de preparação', '1 a 3 dias úteis no nosso atelier em {{country}} (embalagem e verificação de qualidade).'),
      sec('Prazos de entrega', 'Prazos de entrega: até 7 dias úteis após expedição. O prazo indicativo por artigo consta na ficha de produto.'),
      sec('Portes de envio', 'Calculados no checkout. Envio grátis a partir do valor configurado na loja (ver barra promocional).'),
      sec('Acompanhamento', 'Utilize « Seguir encomenda » no rodapé ou na sua conta com o código de encomenda.')
    ]
  };

  var deliveryFr = {
    title: 'Livraison & délais',
    updated: 'Dernière mise à jour : 12 juin 2026',
    sections: [
      sec('Zones', 'Portugal, UE et destinations disponibles au checkout.'),
      sec('Transporteurs', 'DHL Express, CTT — suivi par e-mail.'),
      sec('Préparation', '1–3 jours ouvrés atelier {{country}}.'),
      sec('Délais', 'Délais de livraison : jusqu\'à 7 jours ouvrés après expédition. Délai indicatif par article sur la fiche produit.'),
      sec('Frais', 'Calculés au checkout. Livraison offerte dès le seuil affiché.'),
      sec('Suivi', 'Lien « Suivi de commande » ou espace client.')
    ]
  };

  var deliveryEn = {
    title: 'Delivery & shipping',
    updated: 'Last updated: 12 June 2026',
    sections: [
      sec('Destinations', 'Portugal, EU and other countries when available at checkout.'),
      sec('Carriers', 'DHL Express, CTT — tracking by email.'),
      sec('Preparation', '1–3 business days at our {{country}} atelier.'),
      sec('Delivery times', 'Delivery times: up to 7 business days after dispatch. Indicative lead time per item on the product page.'),
      sec('Shipping costs', 'Calculated at checkout. Free shipping from the store threshold.'),
      sec('Tracking', 'Use « Track order » in the footer or your account.')
    ]
  };

  var deliveryEs = {
    title: 'Envío y plazos',
    updated: 'Última actualización: 12 de junio de 2026',
    sections: [
      sec('Destinos', 'Portugal, UE y otros según checkout.'),
      sec('Transportistas', 'DHL Express, CTT — seguimiento por email.'),
      sec('Preparación', '1–3 días laborables en {{country}}.'),
      sec('Plazos', 'Plazos de entrega: hasta 7 días laborables tras el envío. El plazo indicativo por artículo figura en la ficha de producto.'),
      sec('Gastos', 'Calculados en checkout. Envío gratis desde el umbral indicado.'),
      sec('Seguimiento', '« Seguir pedido » en el pie o en su cuenta.')
    ]
  };

  var faqPt = {
    title: 'Perguntas frequentes',
    updated: 'Última atualização: 12 de junho de 2026',
    sections: [
      sec('Como sigo a minha encomenda?', 'Use o código recebido por e-mail em « Seguir encomenda » (rodapé) ou na sua conta.'),
      sec('Quais os métodos de pagamento?', 'Cartão, MB Way, Multibanco (Stripe), transferência, PayPal ou contra-reembolso — conforme disponível no checkout.'),
      sec('Posso alterar a morada após encomendar?', 'Contacte {{email}} o mais rápido possível. Se a encomenda ainda não foi expedida, tentamos alterar.'),
      sec('Como escolho o tamanho?', 'Consulte o « Guia de tamanhos » — medidas em centímetros, pensado para Portugal.'),
      sec('Onde está a minha fatura?', 'Recibo por e-mail após a compra. Fatura oficial disponível quando configurada na sua área de cliente.')
    ]
  };

  var faqFr = {
    title: 'FAQ',
    updated: 'Dernière mise à jour : 12 juin 2026',
    sections: [
      sec('Suivi commande ?', 'Code e-mail → « Suivi de commande » ou compte client.'),
      sec('Paiements ?', 'Carte, MB Way, virement, PayPal, Stripe — selon checkout.'),
      sec('Changer l\'adresse ?', 'Contactez {{email}} avant expédition.'),
      sec('Taille ?', 'Guide des tailles en cm.'),
      sec('Facture ?', 'Reçu par e-mail ; facture officielle si activée.')
    ]
  };

  var faqEn = {
    title: 'FAQ',
    updated: 'Last updated: 12 June 2026',
    sections: [
      sec('Track my order?', 'Use your email order code in « Track order » or your account.'),
      sec('Payment methods?', 'Card, MB Way, bank transfer, PayPal, Stripe — as shown at checkout.'),
      sec('Change address?', 'Email {{email}} before shipping.'),
      sec('Sizing?', 'See Size guide (cm).'),
      sec('Invoice?', 'Receipt by email; official invoice when enabled in your account.')
    ]
  };

  var faqEs = {
    title: 'Preguntas frecuentes',
    updated: 'Última actualización: 12 de junio de 2026',
    sections: [
      sec('¿Seguir pedido?', 'Código del email en « Seguir pedido » o cuenta.'),
      sec('¿Pagos?', 'Tarjeta, MB Way, transferencia, PayPal, Stripe — según checkout.'),
      sec('¿Cambiar dirección?', 'Email {{email}} antes del envío.'),
      sec('¿Talla?', 'Guía de tallas en cm.'),
      sec('¿Factura?', 'Recibo por email; factura oficial si está activa.')
    ]
  };

  var carePt = {
    title: 'Cuidados com os tecidos',
    updated: 'Última atualização: 12 de junho de 2026',
    sections: [
      sec('T-shirts AZAVISION', 'Lavar do avesso a 30 °C, ciclo delicado. Não usar lixívia. Secar ao ar, à sombra. Passar a ferro do avesso, temperatura média.'),
      sec('Bolsas e acessórios', 'Limpar com pano seco ou ligeiramente húmido. Evitar produtos agressivos. Guardar longe de humidade directa e sol prolongado.'),
      sec('Conservar a forma', 'Não pendurar t-shirts molhadas — secar na horizontal ou cabide largo para manter o corte.'),
      sec('Dúvidas?', 'Contacte {{email}} — teremos prazer em aconselhar.')
    ]
  };

  var careFr = {
    title: 'Entretien des tissus',
    updated: 'Dernière mise à jour : 12 juin 2026',
    sections: [
      sec('T-shirts', 'Lavage 30 °C envers, délicat. Pas d\'eau de Javel. Séchage à l\'air. Repassage envers.'),
      sec('Sacs & accessoires', 'Chiffon sec ou humide. Pas de solvants agressifs.'),
      sec('Forme', 'Ne pas suspendre mouillé — séchage à plat ou cintre large.'),
      sec('Questions ?', '{{email}}')
    ]
  };

  var careEn = {
    title: 'Fabric care',
    updated: 'Last updated: 12 June 2026',
    sections: [
      sec('T-shirts', 'Wash inside out 30 °C, gentle cycle. No bleach. Air dry in shade. Iron inside out, medium heat.'),
      sec('Bags & accessories', 'Wipe with dry or slightly damp cloth. Avoid harsh chemicals.'),
      sec('Shape', 'Do not hang wet — flat dry or wide hanger.'),
      sec('Questions?', '{{email}}')
    ]
  };

  var careEs = {
    title: 'Cuidado de tejidos',
    updated: 'Última actualización: 12 de junio de 2026',
    sections: [
      sec('Camisetas', 'Lavar del revés 30 °C, ciclo suave. Sin lejía. Secar al aire a la sombra. Planchar del revés.'),
      sec('Bolsos y accesorios', 'Paño seco o húmedo. Sin productos agresivos.'),
      sec('Forma', 'No colgar mojado — secar en plano o perchero ancho.'),
      sec('¿Dudas?', '{{email}}')
    ]
  };

  global.InfoContent = {
    returns: { pt: returnsPt, fr: returnsFr, en: returnsEn, es: returnsEs },
    delivery: { pt: deliveryPt, fr: deliveryFr, en: deliveryEn, es: deliveryEs },
    faq: { pt: faqPt, fr: faqFr, en: faqEn, es: faqEs },
    care: { pt: carePt, fr: careFr, en: careEn, es: careEs }
  };
})(typeof window !== 'undefined' ? window : this);
