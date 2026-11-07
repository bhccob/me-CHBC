import type { Dictionary } from './en';

export const nl: Dictionary = {
  /** The home's journey, in formal Dutch (draft for Bob's review): see `en.ts`. */
  journey: {
    hero: {
      from: 'Van code',
      to: 'naar',
      words: ['games.', 'beveiliging.', 'machines.'],
      intro: 'Ik ben Bob Chung, {age}. Geboren en getogen op Aruba, nu in Rotterdam. Ik studeer software, op weg naar mechatronica.',
      cta: 'Bekijk mijn projecten',
      seal: 'PROGRAMMEUR',
      treeAlt: 'Een door de wind gebogen Arubaanse boom waarvan de takken overgaan in gouden printsporen, boven een donkere, nevelige zee.',
      machineAlt: 'Eén machine, laag voor laag gebouwd: een printplaat met code, een gamecontroller, een pantser met een schild, daarna tandwielen en poten.'
    },
    story: { age: 'Leeftijd', from: 'Aruba', to: 'Rotterdam' },
    sheets: [
      {
        title: ['Software', 'Engineering'],
        facts: [
          { label: 'Stack', value: 'Full-stack' },
          { label: 'Opleiding', value: 'MBO 4, Rotterdam' },
          { label: 'Gebouwd', value: 'Webapps, mobiele apps en websites' }
        ],
        line: { lead: 'Het brein.', rest: 'De code die het laat denken.' },
        titleBlock: 'MBO, nu · Blad 1 van 4 · Systems Builder'
      },
      {
        title: ['Game', 'Development'],
        facts: [
          { label: 'Engine', value: 'Godot, Roblox Studio' },
          { label: 'Gebouwd', value: 'Browser-, Roblox- en platformgames' }
        ],
        line: { lead: 'De besturing.', rest: 'Hoe iemand ermee speelt.' },
        titleBlock: 'MBO, nu · Blad 2 van 4 · Systems Builder'
      },
      {
        title: ['Cybersecurity', 'Stagiair'],
        facts: [
          { label: 'Nu', value: 'Stagiair bij een cybersecuritybedrijf' },
          { label: 'Mogelijke richting', value: 'DevSecOps, firmwarebeveiliging' }
        ],
        line: { lead: 'Het pantser.', rest: 'Wat het veilig houdt.' },
        titleBlock: 'Stage, nu · Blad 3 van 4 · Systems Builder'
      },
      {
        title: ['Mechatronica'],
        facts: [
          { label: 'Volgende stap', value: 'HBO' },
          { label: 'Interesse en oriëntatie', value: 'Sensoren, motoren, circuits' },
          { label: 'Doel', value: 'Een eigen bedrijf of een master' }
        ],
        line: { lead: 'Het lichaam.', rest: 'Tandwielen, motoren en beweging.' },
        titleBlock: 'HBO, hierna · Blad 4 van 4 · Systems Builder'
      }
    ],
    stack: {
      title: 'Eén machine.',
      text: 'Elk vakgebied dat ik leer, is er een laag van. Samen maken ze iets wat denkt, reageert, veilig blijft en beweegt.',
      labels: {
        armour: { name: 'Pantser', field: 'Cybersecurity' },
        controls: { name: 'Besturing', field: 'Game Development' },
        brain: { name: 'Brein', field: 'Software Engineering' },
        body: { name: 'Lichaam', field: 'Mechatronica' }
      }
    },
    portal: { word: 'Projecten' },
    flight: { open: 'Project openen', back: 'Terug' },
    calm: { fallback: 'De 3D kon hier niet starten, dus dit is de eenvoudige versie.', lite: 'Open de lichte versie', noScript: 'Deze pagina beweegt met script aan. Zonder script staat alles in de lichte versie.' },
    qaWord: 'Q&A',
    collapse: { hint: 'Klik op het licht om het los te laten, of scrol verder' },
    end: {
      kicker: 'Einde van het portfolio',
      title: 'Laten we praten.',
      promise: 'Elk universum begint klein. Elk project ook.',
      note: 'Heeft iets hiervan u op een idee gebracht, of hebt u een project of een vraag? Ik hoor het graag.',
      toy: 'Beweeg om de sterren aan te trekken. Houd ergens ingedrukt en laat los om uw eigen universum te starten.',
      email: 'E-mail',
      github: 'GitHub',
      instagram: 'Instagram',
      message: 'Stuur een bericht',
      reach: 'Manieren om Bob te bereiken',
      place: 'Rotterdam, geboren op Aruba',
      top: 'Terug naar het begin'
    },
    rail: { label: 'Hoofdstukken', who: 'Wie', software: 'Software', games: 'Games', security: 'Beveiliging', mechatronics: 'Mechatronica', stack: 'Machine', projects: 'Projecten', qa: 'Q&A', contact: 'Contact' },
    sound: { on: 'Geluid aan', off: 'Geluid uit' },
    cursor: { open: 'OPEN' },
    loader: { withSound: 'Binnengaan met geluid', without: 'Binnengaan zonder' }
  },
  meta: {
    homeTitle: 'Bob Chung | Software engineering-student in Rotterdam',
    homeDescription:
      'Portfolio van Bob Chung, student software engineer in Rotterdam: game- en webprojecten, op weg naar systems- en firmware-security-engineering.',
    liteDescription: 'De lichte versie van het portfolio van Bob Chung: alle inhoud als gewone tekst, zonder 3D.',
    contactTitle: 'Contact opnemen',
    contactDescription: 'Stuur Bob Chung direct een bericht via zijn portfolio, of vind hem op GitHub en Instagram.',
    notFoundTitle: 'Pagina niet gevonden',
    notFoundDescription: 'Deze pagina bestaat niet. Ga terug naar het portfolio van Bob Chung.'
  },
  nav: {
    work: 'Werk',
    about: 'Over mij',
    career: 'Loopbaan',
    contact: 'Contact',
    send: 'Stuur een bericht',
    menu: 'Menu',
    close: 'Menu sluiten',
    terminal: 'Terminal openen',
    skip: 'Direct naar de inhoud',
    language: 'Taal',
    switchTo: 'View this page in English',
    home: 'Bob Chung, terug naar home'
  },
  hero: {
    hello: 'Hoi, ik ben',
    name: ['Bob', 'Chung'],
    motto: [
      ['Ik bouw met', 'fat'],
      ['nieuwsgierigheid', 'light'],
      ['& test met', 'fat'],
      ['eerlijkheid.', 'light']
    ],
    role: 'Student software engineer · Rotterdam, NL',
    hint: 'Beweeg over mijn naam',
    hintTouch: 'Tik op mijn naam',
    badge: 'Student software engineer • Geboren op Aruba • Woont in Rotterdam • ',
    scroll: 'Scroll omlaag'
  },
  work: {
    title: 'Projecten, <em>build voor build.</em>',
    intro:
      'Mijn projecten zijn ingedeeld per vakgebied. Kies een categorie om de projecten te bekijken: wat elk project is, hoe het gebouwd is en waar ik op focuste.',
    countOne: '1 project',
    countMany: '{n} projecten',
    project: 'Project',
    category: 'Categorie',
    type: 'Type',
    year: 'Jaar',
    role: 'Rol',
    stack: 'Gebouwd met',
    status: 'Status',
    github: 'Bekijk op GitHub',
    caseStudy: 'Lees de case study',
    view: 'Bekijk projecten',
    rail: 'Projecten',
    nextTitle: 'Volgende categorie: <em>systems & security.</em>',
    nextText:
      'De richtingen die ik verken, lopen naar systems en security. Zodra projecten op dat gebied klaar zijn, krijgen ze hier een eigen categorie.',
    nextLink: 'Bekijk de roadmap',
    heldTitle: 'Niet alles staat hier',
    heldText:
      'Er bestaan eerdere projecten, maar alleen werk dat voldoet aan de standaard die ik voor dit portfolio hanteer, komt op deze pagina.'
  },
  about: {
    title: 'De route <em>tot nu toe.</em>',
    mixed: [
      ['Ik ben Bob,', 'fat'],
      ['een', 'light'],
      ['{age}-jarige', 'fat-yellow'],
      ['student', 'caps'],
      ['software engineer.', 'fat'],
      ['Geboren en getogen op', 'light'],
      ['Aruba,', 'fat'],
      ['Chinees', 'fat-yellow'],
      ['van afkomst,', 'light'],
      ['en sinds mijn achttiende in', 'caps'],
      ['Rotterdam.', 'fat']
    ],
    lead:
      'Ik ben Bob Chung, een <span data-age>{age}</span>-jarige student software engineer in Rotterdam. Geboren en getogen op Aruba en Chinees van afkomst; op mijn achttiende verhuisde ik naar Nederland.',
    body:
      'Ik werk aan databases, gameontwikkeling en webontwikkeling, en elke discipline scherpt de andere aan. Hardware en elektrotechniek zijn de volgende haltes op mijn route. Ik bouw met nieuwsgierigheid en test met eerlijkheid.',
    quote: 'Thuis is voor mij niet één plek. Het is een mix van culturen en de vragen die ik blijf najagen.',
    thoughtLabel: 'Een regel die ik volg',
    thought: '“Overdenken is angst die zich voordoet als logica.”',
    portraitAlt: 'Portret van Bob Chung',
    facts: {
      age: 'Leeftijd',
      born: 'Geboren',
      bornValue: 'Aruba',
      heritage: 'Afkomst',
      heritageValue: 'Chinees',
      based: 'Woont in',
      basedValue: 'Rotterdam, NL',
      studying: 'Opleiding',
      studyingValue: 'MBO 4, Rotterdam'
    },
    route: {
      label: 'Herkomstroute',
      heritage: 'Afkomst',
      heritagePlace: 'China',
      born: 'Geboren & getogen',
      bornPlace: 'Aruba',
      now: 'Sinds mijn achttiende',
      nowPlace: 'Rotterdam'
    },
    clock: {
      label: 'Lokale tijd',
      apart: '{h} uur verschil'
    }
  },
  skills: {
    title: 'Waar ik mee <em>werk.</em>',
    statement: [
      ['Een stevige', 'light'],
      ['full-stack', 'fat-yellow'],
      ['basis,', 'fat'],
      ['aangescherpt richting', 'light'],
      ['systems', 'fat'],
      ['en', 'light'],
      ['firmware,', 'fat'],
      ['versneld door', 'caps'],
      ['AI', 'fat-yellow'],
      ['en nieuwsgierig naar', 'light'],
      ['hardware.', 'fat']
    ],
    statementSpoken: 'Een stevige full-stack basis, aangescherpt richting systems en firmware, versneld door AI en nieuwsgierig naar hardware.',
    rows: [
      {
        status: 'Stevig',
        title: 'Full-stack basis',
        text: 'Een gedegen beheersing van de basisprogrammeertalen, relationele databases met SQL, gameontwikkeling in Godot en moderne frameworks: genoeg om een project te bouwen van de database tot en met de interface.'
      },
      {
        status: 'Bezig',
        title: 'Specialiseren',
        text: 'Ik verdiep me in de specifieke vaardigheden die mijn mogelijke toekomstige rollen vragen, binnen engineering en cybersecurity: programmeren dicht op de hardware voor embedded systems, betrouwbare datapipelines bouwen, beveiliging integreren in elke fase van de ontwikkeling (DevSecOps) en automatiseren hoe firmware getest en beveiligd wordt.'
      },
      {
        status: 'Dagelijks',
        title: 'Werken met AI',
        text: 'Ik leer AI in mijn voordeel te gebruiken: om sneller onderzoek te doen, ideeën te prototypen en mijn werk te reviewen en testen, terwijl ik verantwoordelijk blijf voor elke regel die ik oplever.'
      },
      {
        status: 'Hierna',
        title: 'Nieuwsgierig naar',
        text: 'Elektronica en de hardware waarop software draait, en financiële technologie (fintech): hoe betaalsystemen, bankplatforms en financiële data ontworpen, beveiligd en betrouwbaar gehouden worden onder strikte regelgeving.'
      }
    ]
  },
  life: {
    title: 'Buiten <em>dienst.</em>',
    text: 'Buiten het programmeren blijf ik in beweging. Ik ben oud-powerlifter en oud-tafeltennisser; tegenwoordig hardloop ik, train ik in de sportschool en game ik om fit, gefocust en in balans te blijven.',
    current: 'Nu',
    former: 'Vroeger',
    hobbies: {
      running: 'Hardlopen',
      runningText: 'Uithoudingsvermogen en een helder hoofd.',
      gym: 'Sportschool',
      gymText: 'Kracht, stap voor stap opgebouwd.',
      gaming: 'Gamen',
      gamingText: 'Spelen, met oog voor goed gamedesign.',
      powerlifting: 'Powerliften',
      tableTennis: 'Tafeltennis'
    }
  },
  career: {
    title: 'Huidige build <em>& roadmap.</em>',
    currentStatus: 'In dienst',
    currentRole: 'Student Software Engineer',
    currentOrg: 'MBO 4 · Rotterdam',
    currentText:
      'Ik bouw een brede softwarebasis op: gameontwikkeling in Godot, webontwikkeling, relationele databases en SQL, frameworks zoals Laravel en programmeerbasis in meerdere talen.',
    hboStatus: 'Hierna',
    hboRole: 'HBO · Technologie',
    hboOrg: 'Na mijn MBO 4 · richting nog open',
    hboText:
      'Na mijn MBO 4 wil ik doorstromen naar het HBO, in een technische richting. Welke opleiding het precies wordt, kies ik nog; richtingen als HBO-ICT, Technische Informatica of Embedded Systems Engineering sluiten aan bij de rollen waar ik naartoe werk.',
    nextStatus: 'Mogelijk',
    roadmapNote: 'De rollen in de roadmap zijn mogelijke stappen in mijn loopbaan: richtingen die mij interesseren en waar ik naartoe werk, geen vaste plannen. Waar ze naartoe leiden, is een eigen bedrijf.',
    rolesToggle: 'Mogelijke toekomstige rollen',
    rolesHint: 'Interesses, geen vaste plannen',
    roleGroups: [
      {
        field: 'Engineering',
        roles: [
          {
            title: 'Embedded Engineer',
            text: 'Software ontwikkelen die direct op hardware draait, van microcontrollers tot verbonden apparaten, binnen strikte grenzen voor geheugen, energieverbruik en timing.'
          },
          {
            title: 'Data Engineer',
            text: 'De pipelines en databases ontwerpen die ruwe data omzetten in een betrouwbare basis voor analyses en beslissingen.'
          }
        ]
      },
      {
        field: 'Cybersecurity',
        roles: [
          {
            title: 'DevSecOps Engineer',
            text: 'Beveiliging integreren in elke fase van softwareontwikkeling en -oplevering, met geautomatiseerde tests van de eerste regel code tot de release.'
          }
        ]
      },
      {
        field: 'Engineering & cybersecurity',
        roles: [
          {
            title: 'Firmware Security Automation Engineer',
            text: 'De low-level code in apparaten beveiligen en automatiseren hoe die getest en geverifieerd wordt: embedded engineering en cybersecurity in één rol.'
          }
        ]
      }
    ],
    sector: {
      label: 'Mogelijke sector',
      title: 'Fintech',
      text: 'Deze vaardigheden zijn ook gewild in de financiële technologie, van beveiligde betaalterminals tot fraudedetectie: een sector waar deze route langs kan leiden, niet de bestemming zelf.'
    },
    goalStatus: 'Doel',
    goalRole: 'Een eigen bedrijf',
    goalOrg: 'Lange termijn · de bestemming',
    goalText:
      'Op de lange termijn wil ik een eigen technologiebedrijf oprichten. De rollen hierboven zijn de route ernaartoe: elk ervan bouwt de ervaring op in hardware, software, data en beveiliging waar zo’n bedrijf op steunt.',
    whyToggle: 'Waarom deze richtingen?',
    why: [
      'Deze richtingen hebben één ding gemeen: ze zijn onmisbaar voor de technologie waar de samenleving steeds meer op steunt. Naarmate verbonden apparaten, data en digitale diensten blijven groeien, groeit ook de vraag naar engineers die ze kunnen bouwen, beveiligen en automatiseren.',
      'Een aantal ervan reikt verder dan het scherm. Embedded- en firmwarewerk brengt software samen met elektrotechniek en werktuigbouwkunde: sensoren uitlezen, motoren en actuatoren aansturen en ontwerpen binnen de grenzen van schakelingen, energie en bewegende onderdelen. Het hele apparaat begrijpen, niet alleen de code, is wat mij in deze vakgebieden aantrekt.',
      'Ze passen bovendien bij mijn persoonlijkheid: ik werk het best wanneer ik me diep en ongestoord kan concentreren op complexe technische problemen. Deze rollen draaien om techniek in plaats van klantcontact en belonen precies die manier van werken.',
      'Bovenal leiden ze naar mijn doel op de lange termijn: een eigen technologiebedrijf oprichten. Elke rol is daar een bouwsteen voor: de elektronica en mechanica van een product, de software die erop draait, de data die het oplevert en de beveiliging die het beschermt.'
    ]
  },
  cta: {
    title: 'Laatste oproep: <em>zeg hallo.</em>',
    text: 'Vragen, kansen of gewoon een hallo: mijn inbox staat open.',
    button: 'Stuur mij een bericht',
    or: 'Of vind mij op'
  },
  contact: {
    title: 'Stuur een <em>bericht.</em>',
    intro: 'Hebt u een vraag of een kans, of wilt u gewoon hallo zeggen? Schrijf het hieronder en het komt in mijn inbox terecht.',
    direct: 'Of bereik mij direct',
    formTitle: 'Uw bericht',
    name: 'Naam',
    namePlaceholder: 'Uw naam',
    email: 'E-mail',
    emailPlaceholder: 'u@voorbeeld.nl',
    subject: 'Onderwerp',
    subjectPlaceholder: 'Waar gaat het over?',
    optional: 'optioneel',
    message: 'Bericht',
    messagePlaceholder: 'Schrijf uw bericht…',
    send: 'Bericht versturen',
    sending: 'Versturen…',
    privacy: 'Uw gegevens worden alleen gebruikt om op uw bericht te reageren.',
    errors: {
      name: 'Vul uw naam in.',
      email: 'Vul een geldig e-mailadres in.',
      message: 'Uw bericht moet minstens 10 tekens bevatten.',
      generic: 'Er ging iets mis bij het versturen. Probeer het opnieuw, of mail mij direct op bhccob@gmail.com.',
      cooldown: 'Uw bericht is net verstuurd. Wacht een minuut voordat u een volgend bericht stuurt.'
    },
    successTitle: 'Bericht verzonden.',
    successText: 'Bedankt voor uw bericht. Ik reageer zo snel mogelijk.',
    again: 'Nog een bericht sturen',
    mailtoTitle: 'Bijna klaar.',
    mailtoText: 'Uw e-mailprogramma zou nu moeten openen met het bericht klaar om te versturen.'
  },
  end: {
    // Six, as the English has (the type says so): Bob's own questions and answers (2026-10-25). An answer left out shows
    // the placeholder.
    questions: [
      {
        question: 'Wat is je plan na het MBO?',
        answer:
          'Na het MBO wil ik Mechatronica gaan studeren aan Fontys Hogeschool. Zo verbreed ik mijn kennis van (elektrische) hardware, terwijl software een rol blijft spelen. Als alles goed gaat, wil ik daarna een master behalen die hardware en software combineert.'
      },
      {
        question: 'Aan wat voor baan denk je?',
        answer:
          'Ik heb nog geen definitieve keuze gemaakt. Technologie blijft zich ontwikkelen, en daarmee verandert ook de vraag naar banen. Daarom heb ik voor mechatronica gekozen: een brede basis waarmee ik in elk vakgebied binnen de techniek van waarde kan zijn. Op de lange termijn wil ik een eigen bedrijf oprichten.'
      },
      {
        question: 'Wat zijn je hobby’s?',
        answer: 'Ik hardloop, train met gewichten en game. Eerder kwam ik op hoog niveau uit in powerliften en tafeltennis.'
      },
      {
        question: 'Waar zie je jezelf wonen en werken?',
        answer: 'Voorlopig zie ik mijn toekomst in Europa, maar ik sta open voor andere mogelijkheden als mijn plannen veranderen.'
      },
      {
        question: 'Waar werk je op dit moment mee?',
        answer:
          'Ik heb een full-stack basis: een gedegen beheersing van de basisprogrammeertalen, relationele databases met SQL, gameontwikkeling in Godot en moderne frameworks. Genoeg om een project te bouwen van de database tot en met de interface.'
      },
      {
        question: 'Waar is deze site mee gemaakt?',
        answer:
          'Deze site is zelf ook een project. Hij is geschreven in TypeScript met React en React Router, en de pagina’s worden vooraf als statische HTML gegenereerd, in het Nederlands en het Engels. De 3D-scènes draaien op Three.js via React Three Fiber, met modellen die in Blender zijn gemaakt. Geautomatiseerde tests en een browsertest met echte invoer controleren de site. Voor elke release controleert een Python-auditor op elke pagina de titels, beschrijvingen, links en alt-teksten, en stopt de release als er iets niet klopt.'
      }
    ],
    placeholder: 'Antwoord volgt.',
    placeholderTag: 'placeholder'
  },
  project: {
    back: 'Alle categorieën',
    shelf: 'Projecten in {category}',
    previous: 'Vorige',
    next: 'Volgende',
    keys: 'Gebruik ← en → om van project te wisselen',
    overview: 'Overzicht',
    build: 'Hoe het gebouwd is',
    focus: 'Focus',
    alsoSee: 'Ook bekijken',
    moreTitle: 'Er komen <em>meer projecten aan.</em>',
    moreText: 'Nieuw werk is in ontwikkeling of wacht op publicatie, en eerdere projecten die niet aan mijn standaard voldoen, staan hier niet.',
    moreLink: 'Terug naar alle categorieën'
  },
  /** The other pages' shared words: the Lite page's name, the back link, a project's live site, and Lite's Q&A heading. */
  pages: {
    lite: 'Lichte versie',
    back: 'Esc · terug',
    site: 'Naar de site',
    questions: 'Vragen'
  },
  notFound: {
    status: 'Vervallen',
    title: 'Deze pagina is <em>vervallen.</em>',
    text: 'De pagina die u zoekt bestaat niet (meer). De site is opnieuw gebouwd, dus sommige oude links zijn verplaatst.',
    home: 'Terug naar het vertrekbord'
  },
};
