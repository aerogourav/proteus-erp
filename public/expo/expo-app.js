/* BOH Expo CRM: phone field app for trade-show conversations. Plain script, mounted by src/components/expo/expo-shell.tsx.
   mount(root, store) where store is null (this phone only) or { userId, email, list(), save(id, data), signOut() }. */
(function () {
  "use strict";
  var TARGETS = {
   "10micron": {
    "name": "10Micron",
    "booth": "G43",
    "country": "Italy",
    "url": "https://10micron.eu/en",
    "what": "Designs and manufactures professional telescope mounts with precision mechanics, electronics and software.",
    "why": "Small product manufacturer.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "2ndspace": {
    "name": "2NDSpace SRL",
    "booth": "B40",
    "country": "Italy",
    "url": "https://2ndspace.eu",
    "what": "Italian space engineering company developing customisable CubeSat platforms and subsystems.",
    "why": "Hardware startup: ask about price and setup effort.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "abs-technics": {
    "name": "ABS Technics BV",
    "booth": "Z39",
    "country": "Belgium",
    "url": "https://abstechnics.com",
    "what": "Belgian manufacturer of RF and microwave absorber materials with its own production facility.",
    "why": "Very small manufacturer: the 'before an ERP' view.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "absolut-system": {
    "name": "ABSOLUT SYSTEM",
    "booth": "U17",
    "country": "France",
    "url": "https://absolut-system.com/en/space",
    "what": "Custom cryogenic equipment for space, industry and research.",
    "why": "Engineer-to-order. Same stand as Micronor.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "acktar": {
    "name": "ACKTAR (ACM Coatings GmbH)",
    "booth": "K45",
    "country": "Germany",
    "url": "https://de.acktar.com",
    "what": "Ultra-black, light-absorbing coatings and foils, qualified for space.",
    "why": "Coating customer parts is job-based.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "acmh": {
    "name": "A.C.M.H - Ateliers de Construction Mécanique de Honfleur",
    "booth": "U29",
    "country": "France",
    "url": "https://acmh.fr",
    "what": "Designs and manufactures satellite transport containers, integration trolleys and ground support equipment.",
    "why": "Mechanical fabrication workshop, one-off projects.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "active-space-tech": {
    "name": "ACTIVE SPACE TECHNOLOGIES S.A.",
    "booth": "C09",
    "country": "Portugal",
    "url": "https://activespacetech.com",
    "what": "Electromechanical, structural and thermal systems for space and defence.",
    "why": "Small build-to-order hardware company on the Portugal stand.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "additive-willmann": {
    "name": "Additive Willmann",
    "booth": "4182",
    "country": "Germany",
    "url": "https://additive-willmann.de",
    "what": "Contract manufacturer of metal 3D printed parts with certified processes.",
    "why": "Small German contract manufacturer. Near stands 4106, 4111 and 4196.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "aedus-space": {
    "name": "Aedus Space Kft.",
    "booth": "Y07",
    "country": "Hungary",
    "url": "https://aedusspace.com",
    "what": "Hungarian-owned company for high-precision manufacturing, material science and space work.",
    "why": "Precision manufacturer on the Hungarian stand.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "almexa": {
    "name": "AlmexA A/S",
    "booth": "Z19",
    "country": "Denmark",
    "url": "https://almexa.com",
    "what": "Precision CNC machining of aluminium components for space, defence and subsea: 3- and 5-axis machining, assembly, quality inspection.",
    "why": "Specialist CNC shop. Shares stand Z19 with Ravi Electronics.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "apr": {
    "name": "APR",
    "booth": "P10",
    "country": "Italy",
    "url": "https://apr.it",
    "what": "Pumps and valves for propulsion and thermal control, designed and made in house.",
    "why": "Own products made in house. Italian pavilion.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "apt": {
    "name": "APT advanced premium technologies GmbH",
    "booth": "W34",
    "country": "Germany",
    "url": "https://apt-gmbh.de",
    "what": "High-purity media, vacuum and cooling-water systems plus precision mechanical assemblies, in Bovenden.",
    "why": "Project-based mechanical work.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "aquatec": {
    "name": "AQUAtec Machining AG",
    "booth": "G47",
    "country": "Switzerland",
    "url": "https://aquatec-machining.ch",
    "what": "High-precision CNC machining of large-scale components for aerospace and semiconductor equipment.",
    "why": "Same stand as PWB AG.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "aviotec": {
    "name": "AVIOTEC SRL",
    "booth": "P10",
    "country": "Italy",
    "url": "https://aviotec.it",
    "what": "Thermal control and electrical harness subsystems.",
    "why": "Manual, made-to-drawing work. Italian pavilion.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "benozzi": {
    "name": "Benozzi Engineering s.r.l.",
    "booth": "P10",
    "country": "Italy",
    "url": "https://benozzi.com",
    "what": "High-precision mechanical machining since 1974, 3,200 sqm facility with six business units.",
    "why": "Established machining firm: likely has an ERP, ask what it fails at.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "cemec": {
    "name": "CEMEC GmbH",
    "booth": "F34",
    "country": "Germany",
    "url": "https://cemec.de",
    "what": "Since 1999: complex mechatronic assemblies, precision mechanisms and optical assemblies for space, in series production.",
    "why": "Small German maker of assemblies with heavy documentation needs.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "claren-tools": {
    "name": "Claren Tools S.r.l.",
    "booth": "P10",
    "country": "Italy",
    "url": "https://clarentools.it",
    "what": "CNC high-precision machining of metal components and injection mould manufacturing.",
    "why": "CNC job shop on the Italian pavilion (P10).",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "elfi-electronics": {
    "name": "ELFI Electronics",
    "booth": "P10",
    "country": "Italy",
    "url": "https://elfisrl.com/en",
    "what": "Electronics manufacturing service founded 2004 in Pistoia, for railway, defence and aerospace equipment.",
    "why": "Small-batch electronics maker: tests BOH outside machining.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "elfon": {
    "name": "Elfon Ltd",
    "booth": "Q34",
    "country": "Greece",
    "url": "https://elfon.gr",
    "what": "Manufacturer of wiring harnesses and electromechanical assemblies, subcontractor to primes.",
    "why": "Subcontractor: ask what customers demand in traceability.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "erre-ti": {
    "name": "ERRE TI - Composite Solutions",
    "booth": "Z25",
    "country": "Italy",
    "url": "https://erreti.eu",
    "what": "Family-owned maker of carbon fibre and composite components. Prototypes and limited series with a 25-person team.",
    "why": "25 people, family-owned, prototypes and small series: ideal size.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "fraschini": {
    "name": "Eligio Re Fraschini Spa",
    "booth": "P10",
    "country": "Italy",
    "url": "https://refraschini.it",
    "what": "Tools and parts in carbon composite and metals since 1946.",
    "why": "Established manufacturer. Italian pavilion.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "goimek": {
    "name": "GOIMEK",
    "booth": "Q16",
    "country": "Spain",
    "url": "https://goimek.com/en",
    "what": "High-precision machining company in the Basque Country with 30 years of space work.",
    "why": "Experienced machining shop: ask what their system cannot do.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "henze": {
    "name": "Henze Boron Nitride Products AG",
    "booth": "4196",
    "country": "Germany",
    "url": "https://henze-bnp.de",
    "what": "Develops, produces and machines custom boron nitride materials and products.",
    "why": "Custom made-to-order parts. Near stand 4182.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "horizon": {
    "name": "Horizon Microtechnologies GmbH",
    "booth": "1310",
    "country": "Germany",
    "url": "https://horizonmicrotechnologies.com",
    "what": "Micro and precision components made by 3D printing in polymer with metallic and other coatings.",
    "why": "Young German manufacturer: ask when spreadsheets stopped working.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "hps": {
    "name": "HPS GmbH",
    "booth": "J53",
    "country": "Germany",
    "url": "https://hps-gmbh.com",
    "what": "Founded 2000; with HPS Romania and HPtex a group of three sites with more than 90 employees.",
    "why": "Bavarian stand J53, with MACCON and STT.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "innolite": {
    "name": "Innolite GmbH",
    "booth": "H53",
    "country": "Germany",
    "url": "https://innolite.de",
    "what": "Optics production with advanced diamond machining technologies.",
    "why": "Precision machining specialist.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "kern": {
    "name": "Kern Microtechnik GmbH",
    "booth": "V11",
    "country": "Germany",
    "url": "https://kern-microtechnik.com",
    "what": "CNC precision machining centres and contract manufacturing since 1962.",
    "why": "Runs its own contract manufacturing: ask how they plan and track jobs.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "leuka": {
    "name": "LEUKA GmbH",
    "booth": "Z08",
    "country": "Germany",
    "url": "https://leuka.de",
    "what": "Medium-sized manufacturing company in Weiler-Simmerberg supplying aerospace, defence, semiconductor and high-tech customers.",
    "why": "Mid-sized supplier: ask which ERP they run and what still lives in Excel.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "maccon": {
    "name": "MACCON GmbH & Co. KG",
    "booth": "J53",
    "country": "Germany",
    "url": "https://maccon.de",
    "what": "Motion components and systems for space, from off-the-shelf to fully customised designs.",
    "why": "Bavarian stand J53.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "mazarom": {
    "name": "MAZAROM IMPEX SRL",
    "booth": "R29",
    "country": "Romania",
    "url": "https://card-sat.com",
    "what": "EN 9100 certified design and manufacturing of high-precision mechanical parts for aerospace, with CNC machining.",
    "why": "Certified machining supplier: ask how they keep inspection records per job.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "mecasoft": {
    "name": "Mecasoft",
    "booth": "T15",
    "country": "Belgium",
    "url": "https://mecasoft.be",
    "what": "Belgian EN 9100 certified precision engineering company for ultra-high-precision manufacturing.",
    "why": "Small certified shop. Shares stand T15 with Wielandts.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "microcertec": {
    "name": "Microcertec / Cerafast",
    "booth": "D09",
    "country": "France",
    "url": "https://microcertec.com",
    "what": "Customised advanced ceramic components, from prototyping to series, with high-precision machining and PVD coating.",
    "why": "Custom parts in small series.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "microlan": {
    "name": "MICROLAN AEROSPACE SL",
    "booth": "L28",
    "country": "Spain",
    "url": "https://microlanaerospace.com",
    "what": "Manufactures high-precision mechanical parts for the space industry, especially demanding geometries.",
    "why": "Small precision parts maker on the Spanish stand.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "micronor": {
    "name": "MICRONOR SAS",
    "booth": "U17",
    "country": "France",
    "url": "https://micronor.fr",
    "what": "Sub-contractor for custom hermetic interconnections, metallisation, electroplating and PVD. Prototypes, small and medium series, built to spec.",
    "why": "A real subcontractor. Shares stand U17 with Absolut System.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "mil-kabel": {
    "name": "MIL-KABEL-SYSTEMS GmbH",
    "booth": "J26",
    "country": "Germany",
    "url": "https://mil-kabel-systems.com",
    "what": "Complete cable systems for industry, railway, aviation, military and special technology.",
    "why": "Cable assembly is order-by-order work with many variants.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "mps-roding": {
    "name": "MPS Roding GmbH",
    "booth": "T62",
    "country": "Germany",
    "url": "https://mps-muehlbauer.com",
    "what": "Muehlbauer Parts & Systems: in-house milling, turning, welding, coating and cleanroom assembly.",
    "why": "Part of a larger group. Good for learning what a mature setup looks like.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "pelzer": {
    "name": "PELZER Maschinenbau und CNC-Zerspanungstechnik GmbH",
    "booth": "4111",
    "country": "Germany",
    "url": "",
    "what": "CNC milling and turning to customer drawings or 3D models, in aluminium, stainless steel and plastics. On the Thuringian joint stand with ONPOINT.",
    "why": "Pure German CNC job shop working from customer drawings: exactly the BOH demo case. Speak German.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "pronexos": {
    "name": "Pronexos",
    "booth": "K52",
    "country": "Netherlands",
    "url": "https://pronexos.com",
    "what": "Specialist engineering and manufacturing services for the space industry, with certified processes.",
    "why": "Build-to-order manufacturer.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "pwb": {
    "name": "PWB AG",
    "booth": "G47",
    "country": "Switzerland",
    "url": "https://pwb.ch",
    "what": "Swiss precision mechanics and high-quality CNC manufacturing.",
    "why": "Precision job shop. Shares stand G47 with AQUAtec.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "ravi": {
    "name": "Ravi Electronics ApS",
    "booth": "Z19",
    "country": "Denmark",
    "url": "https://ravi.dk",
    "what": "Danish AS9100D certified electronics manufacturing service, IPC Class 3 assembly.",
    "why": "Same stand as AlmexA.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "rialnova": {
    "name": "RIALNOVA S.R.L.",
    "booth": "P10",
    "country": "Italy",
    "url": "https://rialnova.space",
    "what": "Designs and manufactures space mechanisms and hardware.",
    "why": "Small hardware maker. Italian pavilion.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "saturne": {
    "name": "Saturne Technology",
    "booth": "J45",
    "country": "Luxembourg",
    "url": "https://saturne-technology.com",
    "what": "Metal additive manufacturing, cutting, drilling, welding and laser hardfacing for space applications.",
    "why": "Service manufacturer with several processes per job.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "scanfil": {
    "name": "Scanfil Electronics GmbH",
    "booth": "M46",
    "country": "Germany",
    "url": "https://scanfil.de",
    "what": "Electronics manufacturing partner for space and aerospace: PCB assembly, system integration, testing, full traceability.",
    "why": "Large group: ask only what small suppliers get wrong.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "sczesny": {
    "name": "Sczesny Werkzeugbau GmbH",
    "booth": "4106",
    "country": "Germany",
    "url": "",
    "what": "CNC turned and milled parts, prototypes to series, as contract manufacturing (Lohnfertigung). On the Thuringian joint stand with ShapeFab.",
    "why": "Contract machining shop. Ask how a drawing change reaches the machine.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "shapefab": {
    "name": "ShapeFab GmbH",
    "booth": "4106",
    "country": "Germany",
    "url": "",
    "what": "High-precision components from technical glass and ceramics for high-tech applications. Same Thuringian joint stand as Sczesny.",
    "why": "Small precision manufacturer: one stand, two conversations.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "sk-technology": {
    "name": "SK TECHNOLOGY GmbH",
    "booth": "S27",
    "country": "Germany",
    "url": "https://sktechnology.de",
    "what": "Precision components and assemblies, from prototypes to medium series, with CNC milling and turning.",
    "why": "Prototype-to-series job shop. Ask about quoting and job status.",
    "prio": 1,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "spaceoptix": {
    "name": "SPACEOPTIX GmbH",
    "booth": "G23",
    "country": "Germany",
    "url": "https://spaceoptix.de",
    "what": "Engineers, manufactures, integrates and tests metal optical components and systems.",
    "why": "Small German manufacturer with inspection at the centre.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "stt": {
    "name": "STT-SystemTechnik GmbH",
    "booth": "J53",
    "country": "Germany",
    "url": "https://stt-systemtechnik.de",
    "what": "RF data communication equipment for spaceborne, airborne, military and industrial use.",
    "why": "Bavarian stand J53.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "tecnottica": {
    "name": "Tecnottica Consonni Srl",
    "booth": "P10",
    "country": "Italy",
    "url": "https://tecnottica.com",
    "what": "Production of optical parts: lenses, doublets, mirrors, filters.",
    "why": "Italian pavilion.",
    "prio": 3,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   },
   "wielandts": {
    "name": "Wielandts Ultra Precision Machining Technologies",
    "booth": "T15",
    "country": "Belgium",
    "url": "https://upmt.be",
    "what": "Custom high-precision optics made with single point diamond machining.",
    "why": "Same stand as Mecasoft.",
    "prio": 2,
    "src": "Official exhibitor list, spacetechexpo-europe.com",
    "updatedAt": 0
   }
  };
  var SHELL = "<header><div class=\"wrap\">\n  <div class=\"brand\">\n    <svg aria-hidden=\"true\" width=\"30\" height=\"28\" viewBox=\"8 10 84 80\"><path d=\"M38 25C34 34 28 42 18 49C28 45 40 44 52 47Z\" fill=\"#E2654A\"/><circle cx=\"53.5\" cy=\"31\" r=\"16\" fill=\"#E2654A\"/><path d=\"M30 78.500C40 76.500 50 76.500 62.500 83.500C54 77 48 70 43.500 56Z\" fill=\"#F0A93B\"/><circle cx=\"28.500\" cy=\"62.500\" r=\"16\" fill=\"#F0A93B\"/><path d=\"M83.500 56C78 48 74 40 71 29.500C70 39 66 47 58 56Z\" fill=\"#2FA871\"/><circle cx=\"70.500\" cy=\"66.500\" r=\"16.500\" fill=\"#2FA871\"/></svg>\n    <span>BOH ERP <small>EXPO CRM</small></span>\n  </div>\n  <button type=\"button\" id=\"sync\" class=\"sync\" role=\"status\">Loading…</button>\n</div></header>\n\n<main class=\"wrap\" id=\"view\"></main>\n\n<nav class=\"tabs\" aria-label=\"Sections\"><div class=\"wrap\">\n  <button type=\"button\" data-tab=\"list\" id=\"tab-list\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1\"/></svg>Companies</button>\n  <button type=\"button\" data-tab=\"stats\" id=\"tab-stats\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/></svg>Results</button>\n  <button type=\"button\" data-tab=\"share\" id=\"tab-share\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><path d=\"M14 14h3v3M21 14v7h-7v-3\"/></svg>Share</button>\n</div></nav>\n\n<div id=\"sheet\" class=\"sheet\" hidden></div>\n<div id=\"toast\" class=\"toast\" role=\"status\" hidden></div>";
  function mount(root, store) {
  root.innerHTML = SHELL;
  var SITE = "https://proteus-erp-teal.vercel.app";
  var LINKS = [
    { id: "site", label: "Website", url: SITE },
    { id: "demo", label: "Live demo", url: SITE + "/demo" },
    { id: "tut", label: "Video tutorials", url: SITE + "/tutorials" },
    { id: "contact", label: "Book a workflow call", url: SITE + "/contact" }
  ];
  var STATUS = { todo: "To visit", talked: "Talked", follow: "Follow up", nofit: "Not a fit" };
  var QUESTIONS = [
    { k: "q1", q: "How do you track a job from customer order to delivery today?", chips: ["Excel", "Paper", "ERP", "Own tool", "Email / folders"], ck: "tools", ph: "Which system? Who keeps it up to date?" },
    { k: "q2", q: "Where does it go wrong most often?", chips: ["Drawing revisions", "Missing material", "Job status unknown", "Inspection papers", "Quotes / invoices", "Nothing big"], ck: "pains", ph: "Their words, one real example" },
    { k: "q3", q: "Last time that happened, what did it cost you?", ph: "Hours, euros, scrap, a late delivery…" },
    { k: "q4", q: "Have you tried an ERP or another tool? What happened?", ph: "Which one, why it stuck or did not" },
    { k: "q5", q: "Who decides on software here, and what monthly price feels fair?", ph: "Role, budget range, setup fee OK?" },
    { k: "q6", q: "If one thing worked perfectly from day one, what should it be?", ph: "The first workflow they would want" }
  ];
  var NEXT = ["Send demo link", "Book workflow call", "Pilot waitlist", "Intro to someone", "Nothing"];
  var leads = {}, me = { name: "Gourav Mehta · Founder", phone: "", email: "", updatedAt: 0 }, pending = {}, timers = {}, loaded = false, syncErr = "";
  var tab = "list", filter = "all", search = "", openId = null, shareLink = "site", sortBy = "prio";
  var view = root.querySelector("#view"), sheet = root.querySelector("#sheet"), syncEl = root.querySelector("#sync"), toastEl = root.querySelector("#toast");
  var CACHE = "boh-expo-crm-v2" + (store ? ":" + store.userId : "");
  function seeds() { var o = {}; Object.keys(TARGETS).forEach(function (id) { o[id] = JSON.parse(JSON.stringify(TARGETS[id])); }); return o; }
  function ids() { return Object.keys(leads).filter(function (id) { return !leads[id].deleted; }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.hidden = true; }, 2200); }
  // ---- storage: every change is kept on this phone first, then sent to the backend; unsent changes survive a reload ----
  function saveCache() {
    var edited = {}; Object.keys(leads).forEach(function (id) { if ((leads[id].updatedAt || 0) > 10) edited[id] = leads[id]; });
    try { localStorage.setItem(CACHE, JSON.stringify({ leads: edited, me: me, pending: pending })); } catch (e) {}
  }
  function loadCache() {
    leads = seeds();
    try { var c = JSON.parse(localStorage.getItem(CACHE) || "null"); if (c && c.leads) { Object.keys(c.leads).forEach(function (id) { leads[id] = c.leads[id]; }); pending = c.pending || {}; if (c.me && c.me.updatedAt) me = c.me; } } catch (e) {}
  }
  function setSync() {
    var n = Object.keys(pending).length, off = false, text = "Saved";
    if (!store) { text = "On this phone only"; off = true; }
    else if (!loaded) text = "Loading…";
    else if (n && !navigator.onLine) { text = "Offline · " + n + " kept here"; off = true; }
    else if (syncErr) { text = n ? "Not synced · " + n : "Not syncing"; off = true; }
    else if (n) text = "Saving " + n + "…";
    syncEl.textContent = text; syncEl.className = "sync" + (off ? " off" : "");
  }
  function push(id) {
    if (!store || !pending[id]) return;
    var stamp = pending[id], doc = id === "_me" ? me : leads[id];
    if (!doc) { delete pending[id]; return; }
    store.save(id, doc).then(function () { syncErr = ""; if (pending[id] === stamp) { delete pending[id]; saveCache(); } setSync(); }, function (e) { syncErr = (e && e.message) || "Could not reach the backend"; setSync(); });
  }
  function flush() { Object.keys(pending).forEach(push); }
  function change(id, patch) {
    var doc = leads[id]; if (!doc) return;
    Object.keys(patch).forEach(function (k) { doc[k] = patch[k]; });
    doc.updatedAt = Date.now(); pending[id] = doc.updatedAt; saveCache(); setSync();
    clearTimeout(timers[id]); timers[id] = setTimeout(function () { push(id); }, 900);
  }
  function remove(id) { change(id, { deleted: true }); }
  function merge(rows) {
    rows.forEach(function (r) {
      var data = r.data; if (!data || typeof data !== "object") return;
      if (r.id === "_me") { if (!pending._me) me = data; return; }
      if (r.id === openId) return;
      var mine = leads[r.id];
      if (pending[r.id] && mine && (mine.updatedAt || 0) >= (data.updatedAt || 0)) return;
      leads[r.id] = data;
    });
    loaded = true; syncErr = ""; saveCache(); setSync(); if (!openId && !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))) render(); flush();
  }
  var busy = false;
  function refresh() {
    if (!store || busy || !navigator.onLine) { setSync(); return; }
    busy = true;
    store.list().then(function (rows) { busy = false; merge(rows || []); }, function (e) { busy = false; loaded = true; syncErr = (e && e.message) || "Could not reach the backend"; setSync(); });
  }
  // ---- views ----
  function sorted() {
    var q = search.trim().toLowerCase();
    return ids().map(function (id) { var l = leads[id]; l._id = id; return l; }).filter(function (l) {
      if (filter === "top" && l.prio !== 1) return false;
      if (filter !== "all" && filter !== "top" && (l.status || "todo") !== filter) return false;
      if (q && (l.name + " " + l.booth + " " + l.what + " " + l.country).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (sortBy === "prio" ? (a.prio || 3) - (b.prio || 3) : 0) || String(a.booth || "~").localeCompare(String(b.booth || "~"), undefined, { numeric: true }) || String(a.name).localeCompare(String(b.name)); });
  }
  function counts() {
    var all = ids().map(function (id) { return leads[id]; });
    var talked = all.filter(function (l) { return l.status === "talked" || l.status === "follow" || l.status === "nofit"; });
    return {
      total: all.length, talked: talked.length,
      fit: all.filter(function (l) { return (l.fit || 0) >= 4; }).length,
      cost: all.filter(function (l) { return (l.q3 || "").trim(); }).length,
      meet: all.filter(function (l) { return arr(l.next).indexOf("Book workflow call") >= 0; }).length,
      wait: all.filter(function (l) { return arr(l.next).indexOf("Pilot waitlist") >= 0; }).length,
      follow: all.filter(function (l) { return l.status === "follow"; }).length, all: all
    };
  }
  function boothHtml(l) { return '<div class="booth"><small>STAND</small>' + esc(l.booth || "?") + "</div>"; }
  function renderList() {
    var c = counts(), rows = sorted();
    var h = '<h1>Space Tech Expo Europe</h1><p class="muted small">Bremen · 17 to 19 November 2026 · small manufacturers to talk to</p>';
    h += '<div class="score"><div><b>' + c.talked + "/" + c.total + '</b><span>Talked</span></div><div><b>' + c.fit + '</b><span>Good fit</span></div><div><b>' + c.cost + '</b><span>Costed pain</span></div><div><b>' + c.follow + "</b><span>Follow up</span></div></div>";
    h += '<input id="search" class="search" type="search" placeholder="Search name, stand, country" value="' + esc(search) + '" aria-label="Search companies">';
    h += '<div class="chips" role="group" aria-label="Filter">' + [["all", "All"], ["top", "Top targets"], ["todo", "To visit"], ["talked", "Talked"], ["follow", "Follow up"], ["nofit", "Not a fit"]].map(function (f) { return '<button type="button" class="chip" data-filter="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' + f[1] + "</button>"; }).join("") + "</div>";
    h += '<div class="chips" role="group" aria-label="Order"><button type="button" class="chip" data-sort="prio" aria-pressed="' + (sortBy === "prio") + '">Best targets first</button><button type="button" class="chip" data-sort="booth" aria-pressed="' + (sortBy === "booth") + '">Walk by stand number</button></div>';
    if (!c.total) h += '<div class="empty">' + (loaded ? "No companies yet. Add the first one you meet." : "Loading your company list…") + "</div>";
    else if (!rows.length) h += '<div class="empty">Nothing matches this filter.</div>';
    else h += '<ul class="list" id="rows">' + rows.map(function (l) {
      var st = l.status || "todo";
      return '<li><button type="button" class="row" data-open="' + esc(l._id) + '">' + boothHtml(l) + '<span class="row-main"><span class="row-name">' + esc(l.name) + '</span><span class="row-what">' + esc(l.what) + '</span><span class="tags">' +
        (l.prio === 1 ? '<span class="tag">Top target</span>' : "") + '<span class="tag s-' + st + (st === "todo" ? " plain" : "") + '">' + STATUS[st] + "</span>" +
        (l.country ? '<span class="tag plain">' + esc(l.country) + "</span>" : "") + (l.size ? '<span class="tag plain">' + esc(l.size) + " people</span>" : "") + "</span></span></button></li>";
    }).join("") + "</ul>";
    h += '<button type="button" class="btn wide" id="add">+ Add a company I just met</button>';
    view.innerHTML = h;
  }
  function renderStats() {
    var c = counts();
    function tally(key) { var t = {}; c.all.forEach(function (l) { arr(l[key]).forEach(function (v) { t[v] = (t[v] || 0) + 1; }); }); return Object.keys(t).sort(function (a, b) { return t[b] - t[a]; }).map(function (k) { return [k, t[k]]; }); }
    function block(title, rows) { return '<div class="card"><h2>' + title + "</h2>" + (rows.length ? rows.map(function (r) { return '<div class="kv"><span>' + esc(r[0]) + "</span><b>" + r[1] + '</b></div><div class="bar"><i style="width:' + Math.round(100 * r[1] / Math.max(1, c.talked)) + '%"></i></div>'; }).join("") : '<p class="muted small">Fills in as you record conversations.</p>') + "</div>"; }
    var h = "<h1>What the expo told us</h1>";
    h += '<div class="card"><h2>Scoreboard</h2><div class="kv"><span>Conversations</span><b>' + c.talked + "</b><span>Good fit (4 or 5)</span><b>" + c.fit + "</b><span>Mistakes with a cost</span><b>" + c.cost + "</b><span>Workflow calls to book</span><b>" + c.meet + "</b><span>Pilot waitlist</span><b>" + c.wait + "</b></div></div>";
    h += block("How they track jobs today", tally("tools")) + block("Where it goes wrong", tally("pains")) + block("Next steps promised", tally("next"));
    h += '<div class="card"><h2>Take the data with you</h2><p class="muted small">One row per company, with every answer.</p><button type="button" class="btn wide" id="csv">Save as spreadsheet (CSV)</button><button type="button" class="btn ghost wide" id="copyall">Copy all notes as text</button></div>';
    view.innerHTML = h;
  }
  function qrSvg(text) {
    if (typeof qrcode !== "function") return "";
    try { var q = qrcode(0, "M"); q.addData(text); q.make(); var n = q.getModuleCount(), d = "";
      for (var r = 0; r < n; r++) for (var x = 0; x < n; x++) if (q.isDark(r, x)) d += "M" + x + " " + r + "h1v1h-1z";
      return '<svg role="img" aria-label="QR code for ' + esc(text) + '" viewBox="-1 -1 ' + (n + 2) + " " + (n + 2) + '" shape-rendering="crispEdges"><path fill="#1B1930" d="' + d + '"/></svg>';
    } catch (e) { return ""; }
  }
  function renderShare() {
    var link = LINKS.filter(function (l) { return l.id === shareLink; })[0] || LINKS[0], svg = qrSvg(link.url);
    var h = "<h1>Show this to scan</h1>";
    h += '<div class="chips" role="group" aria-label="Which link">' + LINKS.map(function (l) { return '<button type="button" class="chip" data-link="' + l.id + '" aria-pressed="' + (l.id === link.id) + '">' + l.label + "</button>"; }).join("") + "</div>";
    h += '<div class="card">' + (svg ? '<div class="qr">' + svg + "</div>" : '<p class="muted small">QR could not load without signal. Show the link below.</p>') + '<div class="copyrow"><code id="url">' + esc(link.url) + '</code><button type="button" class="btn ghost" data-copy="' + esc(link.url) + '">Copy</button></div><a class="btn wide" style="text-align:center;text-decoration:none" href="' + esc(link.url) + '" target="_blank" rel="noopener">Open ' + esc(link.label.toLowerCase()) + "</a></div>";
    h += '<div class="card"><h2>20-second pitch</h2><p>BOH ERP is a configurable ERP for small manufacturers. One job runs from customer order through drawing revisions, material, shop floor and inspection to the invoice, and a job cannot start on an unapproved drawing or without its material.</p><p class="muted small">Early stage: a working browser demo with fictional data. I am here to learn how you work, not to sell.</p></div>';
    h += '<div class="card"><h2>My details</h2><p class="muted small">Saved to your account, shown only here.</p>' + [["name", "Name and role"], ["phone", "Phone"], ["email", "Email"]].map(function (f) { return '<label class="f">' + f[1] + '<div class="copyrow"><input class="t" id="me-' + f[0] + '" data-me="' + f[0] + '" value="' + esc(me[f[0]]) + '" autocomplete="off"><button type="button" class="btn ghost" data-copyme="' + f[0] + '">Copy</button></div></label>'; }).join("") + "</div>";
    h += '<div class="card"><h2>Account</h2><p class="small">' + (store ? "Signed in as " + esc(store.email) + ". Notes sync to the BOH ERP backend." : "Not signed in: notes stay on this phone.") + "</p>" + (store ? '<button type="button" class="btn ghost wide" id="signout">Sign out</button>' : "") + "</div>";
    view.innerHTML = h;
  }
  function render() {
    ["list", "stats", "share"].forEach(function (t) { var b = root.querySelector("#tab-" + t); if (tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    var keep = document.activeElement && document.activeElement.id === "search";
    if (tab === "list") renderList(); else if (tab === "stats") renderStats(); else renderShare();
    if (keep) { var s = document.getElementById("search"); if (s) { s.focus(); s.setSelectionRange(search.length, search.length); } }
  }

  // ---- company sheet ----
  function chipSet(id, key, options) { var l = leads[id]; return '<div class="chips">' + options.map(function (o) { return '<button type="button" class="chip" data-multi="' + key + '" data-val="' + esc(o) + '" aria-pressed="' + (arr(l[key]).indexOf(o) >= 0) + '">' + esc(o) + "</button>"; }).join("") + "</div>"; }
  function field(id, key, label, hint, type) { var l = leads[id]; return '<label class="f">' + label + (hint ? ' <span class="h">' + hint + "</span>" : "") + '<input class="t" id="f-' + key + '" data-k="' + key + '" type="' + (type || "text") + '" value="' + esc(l[key]) + '" autocomplete="off"></label>'; }
  function openSheet(id) {
    var l = leads[id]; if (!l) return; openId = id;
    var st = l.status || "todo";
    var h = '<div class="sheet-top"><div class="wrap"><button type="button" class="back" id="close">‹ Back</button><b style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l.name) + "</b></div></div>";
    h += '<div class="wrap sheet-body">';
    h += '<div class="card"><div class="hero">' + boothHtml(l) + '<div style="min-width:0"><h1 style="font-size:21px;overflow-wrap:anywhere">' + esc(l.name) + '</h1><p class="muted small">' + esc([l.country, l.size ? l.size + " people (estimate)" : ""].filter(Boolean).join(" · ")) + "</p></div></div>" +
      (l.what ? "<p>" + esc(l.what) + "</p>" : "") + (l.why ? '<p class="say"><b>Why them:</b> ' + esc(l.why) + "</p>" : "") + (/^https:\/\//.test(l.url || "") ? '<a class="btn ghost" style="text-align:center;text-decoration:none" href="' + esc(l.url) + '" target="_blank" rel="noopener">Open their website</a>' : "") + (l.src ? '<p class="muted small">Source: ' + esc(l.src) + ".</p>" : "") + "</div>";
    h += '<div class="card"><h2>Status</h2><div class="chips">' + Object.keys(STATUS).map(function (s) { return '<button type="button" class="chip" data-status="' + s + '" aria-pressed="' + (st === s) + '">' + STATUS[s] + "</button>"; }).join("") + "</div></div>";
    h += '<div class="card"><h2>Who I talked to</h2><div class="two">' + field(id, "person", "Name") + field(id, "role", "Role") + "</div>" + field(id, "contact", "Email or phone", "", "text") + '<div class="two">' + field(id, "team", "Team size") + field(id, "system", "System they use now") + "</div>" +
      '<label class="check"><input type="checkbox" id="f-consent" data-check="consent"' + (l.consent ? " checked" : "") + "><span>They said I may contact them after the expo</span></label></div>";
    h += '<div class="card"><h2>Conversation</h2><p class="say">Opener: “I am building an ERP for small manufacturers and I am not selling today. Can I ask how you run a job from order to delivery?”</p>' +
      QUESTIONS.map(function (q, i) { return '<div class="q"><b><i>' + (i + 1) + "</i>" + esc(q.q) + "</b>" + (q.chips ? chipSet(id, q.ck, q.chips) : "") + '<textarea class="t" id="f-' + q.k + '" data-k="' + q.k + '" placeholder="' + esc(q.ph) + '" aria-label="' + esc(q.q) + '">' + esc(l[q.k]) + "</textarea></div>"; }).join("") + "</div>";
    h += '<div class="card"><h2>My read</h2><label class="f">Fit for BOH ERP <span class="h">1 = no need, 5 = clear pain and they would pay</span></label><div class="chips">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="chip" data-fit="' + n + '" aria-pressed="' + (l.fit === n) + '">' + n + "</button>"; }).join("") + '</div><label class="f">Next step I promised</label>' + chipSet(id, "next", NEXT) +
      '<label class="f">Anything else<textarea class="t" id="f-notes" data-k="notes" placeholder="Quotes, names they mentioned, what surprised me">' + esc(l.notes) + "</textarea></label></div>";
    h += '<div class="card"><h2>Company details</h2>' + field(id, "name", "Company") + '<div class="two">' + field(id, "booth", "Stand") + field(id, "country", "Country") + "</div>" + field(id, "what", "What they make") +
      '<button type="button" class="btn danger wide" id="del">Remove this company</button><div id="delask" hidden><p class="small">Remove ' + esc(l.name) + ' and its notes for good?</p><div class="two"><button type="button" class="btn ghost" id="delno">Keep</button><button type="button" class="btn" id="delyes">Remove</button></div></div></div>';
    h += '<button type="button" class="btn wide" id="close2">Done</button></div>';
    sheet.innerHTML = h; sheet.hidden = false; sheet.scrollTop = 0;
  }
  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ""; openId = null; render(); }

  sheet.addEventListener("input", function (e) {
    var t = e.target; if (!openId) return;
    if (t.dataset.k) { var p = {}; p[t.dataset.k] = t.value; change(openId, p); }
    if (t.dataset.check) { var c = {}; c[t.dataset.check] = t.checked; change(openId, c); }
  });
  sheet.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || !openId) return; var l = leads[openId];
    if (b.id === "close" || b.id === "close2") return closeSheet();
    if (b.dataset.status) { change(openId, { status: b.dataset.status }); press(b, "[data-status]"); }
    else if (b.dataset.fit) { var n = +b.dataset.fit; change(openId, { fit: l.fit === n ? 0 : n }); sheet.querySelectorAll("[data-fit]").forEach(function (x) { x.setAttribute("aria-pressed", String(+x.dataset.fit === leads[openId].fit)); }); }
    else if (b.dataset.multi) { var k = b.dataset.multi, list = arr(l[k]).slice(), i = list.indexOf(b.dataset.val); if (i >= 0) list.splice(i, 1); else list.push(b.dataset.val); var p = {}; p[k] = list; if ((l.status || "todo") === "todo") { p.status = "talked"; press(sheet.querySelector('[data-status="talked"]'), "[data-status]"); } change(openId, p); b.setAttribute("aria-pressed", String(i < 0)); }
    else if (b.id === "del") { document.getElementById("delask").hidden = false; b.hidden = true; }
    else if (b.id === "delno") { document.getElementById("delask").hidden = true; document.getElementById("del").hidden = false; }
    else if (b.id === "delyes") { var id = openId; closeSheet(); remove(id); render(); toast("Removed"); }
  });
  function press(btn, sel) { sheet.querySelectorAll(sel).forEach(function (x) { x.setAttribute("aria-pressed", String(x === btn)); }); }

  view.addEventListener("input", function (e) { var t = e.target; if (t.id === "search") { search = t.value; render(); } else if (t.dataset.me) { me[t.dataset.me] = t.value; me.updatedAt = Date.now(); pending._me = me.updatedAt; saveCache(); setSync(); clearTimeout(timers._me); timers._me = setTimeout(function () { push("_me"); }, 900); } });
  view.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.open) openSheet(b.dataset.open);
    else if (b.dataset.filter) { filter = b.dataset.filter; render(); }
    else if (b.dataset.sort) { sortBy = b.dataset.sort; render(); }
    else if (b.dataset.link) { shareLink = b.dataset.link; render(); }
    else if (b.dataset.copy) copy(b.dataset.copy);
    else if (b.id === "add") { var id = "c" + Date.now().toString(36); leads[id] = { name: "New company", booth: "", country: "", what: "", prio: 2, status: "talked", custom: true, updatedAt: Date.now() }; pending[id] = leads[id].updatedAt; saveCache(); setSync(); push(id); openSheet(id); var f = document.getElementById("f-name"); if (f) { sheet.scrollTop = sheet.scrollHeight; f.focus(); f.select(); } }
    else if (b.id === "csv") exportCsv();
    else if (b.dataset.copyme) copy(me[b.dataset.copyme] || "");
    else if (b.id === "signout" && store) store.signOut();
    else if (b.id === "copyall") copy(asText());
  });
  root.querySelector("nav.tabs").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { tab = b.dataset.tab; render(); window.scrollTo(0, 0); } });

  function copy(text) {
    var done = function () { toast("Copied"); }, fail = function () { toast("Press and hold the text to copy"); };
    try { navigator.clipboard.writeText(text).then(done, fail); } catch (e) { fail(); }
  }
  var COLS = ["name", "booth", "country", "size", "what", "status", "fit", "person", "role", "contact", "team", "system", "consent", "tools", "pains", "q1", "q2", "q3", "q4", "q5", "q6", "next", "notes"];
  function csvText() {
    var cell = function (v) { v = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    return "﻿" + [COLS.join(",")].concat(ids().map(function (id) { var l = leads[id]; return COLS.map(function (k) { return cell(k === "status" ? STATUS[l.status || "todo"] : l[k]); }).join(","); })).join("\r\n");
  }
  function asText() {
    return ids().map(function (id) { return leads[id]; }).filter(function (l) { return (l.status || "todo") !== "todo"; }).map(function (l) {
      return [l.name + " (stand " + (l.booth || "?") + ") · " + STATUS[l.status] + " · fit " + (l.fit || "-"), [l.person, l.role, l.contact].filter(Boolean).join(", "), "Tools: " + arr(l.tools).join(", "), "Pains: " + arr(l.pains).join(", ")]
        .concat(QUESTIONS.map(function (q, i) { return l[q.k] ? "Q" + (i + 1) + ": " + l[q.k] : ""; })).concat(["Next: " + arr(l.next).join(", "), l.notes || ""]).filter(Boolean).join("\n");
    }).join("\n\n") || "No conversations recorded yet.";
  }
  function exportCsv() {
    try {
      var url = URL.createObjectURL(new Blob([csvText()], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
      a.href = url; a.download = "boh-expo-crm.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) { copy(csvText()); }
  }
  syncEl.addEventListener("click", function () { if (syncErr) toast("Not syncing: " + syncErr); else if (!store) toast("Sign in to sync"); else { toast("Checking…"); refresh(); } });

  // ---- boot ----
  loadCache(); if (!store) loaded = true;
  render(); setSync(); refresh();
  var onOnline = function () { setSync(); refresh(); }, onVisible = function () { if (document.visibilityState === "visible") refresh(); };
  window.addEventListener("online", onOnline); window.addEventListener("offline", setSync); document.addEventListener("visibilitychange", onVisible);
  var poll = setInterval(function () { if (document.visibilityState === "visible" && !openId) refresh(); }, 60000);
  if (typeof qrcode !== "function") { var s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; s.onload = function () { if (tab === "share" && !openId) render(); }; document.head.appendChild(s); }
  return function unmount() { clearInterval(poll); window.removeEventListener("online", onOnline); window.removeEventListener("offline", setSync); document.removeEventListener("visibilitychange", onVisible); root.innerHTML = ""; };
  }
  window.BohExpo = { mount: mount };
})();
