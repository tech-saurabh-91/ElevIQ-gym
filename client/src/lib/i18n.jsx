import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr', flag: 'EN' },
  { code: 'es', label: 'Español', dir: 'ltr', flag: 'ES' },
  { code: 'fr', label: 'Français', dir: 'ltr', flag: 'FR' },
  { code: 'de', label: 'Deutsch', dir: 'ltr', flag: 'DE' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr', flag: 'HI' },
  { code: 'ar', label: 'العربية', dir: 'rtl', flag: 'AR' },
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$', rate: 1, country: 'United States' },
  { code: 'EUR', symbol: '€', rate: 0.92, country: 'Europe' },
  { code: 'GBP', symbol: '£', rate: 0.79, country: 'United Kingdom' },
  { code: 'INR', symbol: '₹', rate: 83.4, country: 'India' },
  { code: 'JPY', symbol: '¥', rate: 151.2, country: 'Japan' },
  { code: 'BRL', symbol: 'R$', rate: 5.12, country: 'Brazil' },
  { code: 'AED', symbol: 'د.إ', rate: 3.67, country: 'UAE' },
  { code: 'AUD', symbol: 'A$', rate: 1.52, country: 'Australia' },
  { code: 'CAD', symbol: 'C$', rate: 1.37, country: 'Canada' },
  { code: 'SGD', symbol: 'S$', rate: 1.34, country: 'Singapore' },
  { code: 'ZAR', symbol: 'R', rate: 18.4, country: 'South Africa' },
  { code: 'MXN', symbol: '$', rate: 17.1, country: 'Mexico' },
];

const EN = {
  'nav.home': 'Home',
  'nav.about': 'About',
  'nav.gallery': 'Gallery',
  'nav.contact': 'Contact',
  'nav.pricing': 'Pricing',
  'nav.signin': 'Sign in',
  'nav.register': 'Join now',
  'nav.dashboard': 'Dashboard',
  'nav.logout': 'Log out',
  'nav.menu': 'Menu',

  'hero.badge': 'Live in 3 countries · 500+ members per club',
  'hero.title': 'Train harder. Manage smarter.',
  'hero.sub':
    'GymFlow is the operating system for large-scale fitness facilities — memberships, classes, trainers, equipment, POS and analytics in one cinematic console.',
  'hero.cta1': 'Start free membership',
  'hero.cta2': 'Explore the platform',
  'hero.scroll': 'Scroll to explore',

  'stats.members': 'Active members',
  'stats.classes': 'Classes / week',
  'stats.trainers': 'Certified coaches',
  'stats.locations': 'Club locations',

  'modules.title': 'Ten modules. One command centre.',
  'modules.sub':
    'Everything a 500+ member facility needs — front desk to finance — designed to be operated by one person on a busy Saturday.',
  'classes.title': 'The timetable never sleeps',
  'classes.sub': 'Real sessions, real capacity, real waitlists — bookable in two taps.',
  'classes.book': 'Book seat',
  'classes.booked': 'Booked',
  'classes.seats': 'seats left',

  'gallery.title': 'Inside the facilities',
  'gallery.sub': 'Twelve thousand square feet, zero dead space.',
  'gallery.view': 'Open gallery',

  'pricing.title': 'Membership that scales with you',
  'pricing.sub': 'Base pricing in USD. Switch currency and country anywhere in the header.',
  'pricing.month': '/month',
  'pricing.popular': 'Most popular',
  'pricing.choose': 'Choose plan',

  'reviews.title': 'Rated 4.9 by people who actually train',
  'reviews.sub': 'Verified feedback from members across Bengaluru, Austin and Berlin.',

  'cta.title': 'Your floor, your data, your rules.',
  'cta.text': 'Spin up a full operations console with demo data in under a minute.',
  'cta.button': 'Open the console',

  'about.title': 'Built by operators, not landlords',
  'about.sub': 'GymFlow started as a spreadsheet that refused to die. It became the platform we wished we had.',
  'about.story': 'Our story',
  'about.values': 'Operating principles',
  'about.team': 'The team behind it',
  'about.mission': 'Mission',
  'about.vision': 'Vision',
  'about.missionText': 'Give every fitness operator enterprise-grade tooling without enterprise-grade complexity.',
  'about.visionText': 'A world where running a gym feels as rewarding as training in one.',

  'contact.title': 'Talk to the team',
  'contact.sub': 'Sales, support or partnerships — a human replies within 24 hours.',
  'contact.name': 'Your name',
  'contact.email': 'Email address',
  'contact.phone': 'Phone (optional)',
  'contact.subject': 'Subject',
  'contact.message': 'How can we help?',
  'contact.send': 'Send message',
  'contact.sent': 'Message sent — we will reply within 24 hours.',
  'contact.info': 'Headquarters',
  'contact.hours': 'Support hours',
  'contact.hoursValue': 'Mon–Sun · 05:00 to 23:00 local time',

  'auth.signin': 'Sign in',
  'auth.register': 'Create account',
  'auth.email': 'Email address',
  'auth.password': 'Password',
  'auth.name': 'Full name',
  'auth.have': 'Already have an account?',
  'auth.no': 'New to GymFlow?',
  'auth.submitSignin': 'Enter the console',
  'auth.submitRegister': 'Create my membership',
  'auth.demo': 'Demo logins',
  'auth.demoHint': 'admin@gymflow.io / admin123 · member demo uses member123',

  'footer.tagline': 'The operating system for modern fitness facilities.',
  'footer.product': 'Product',
  'footer.company': 'Company',
  'footer.legal': 'Legal',
  'footer.rights': 'All rights reserved.',

  'common.loading': 'Loading…',
  'common.search': 'Search…',
  'common.viewAll': 'View all',
  'common.learnMore': 'Learn more',
  'common.perMonth': 'per month',
  'common.close': 'Close',
  'common.country': 'Country & currency',
  'common.language': 'Language',
};

const DICT = {
  en: EN,
  es: {
    'nav.home': 'Inicio', 'nav.about': 'Nosotros', 'nav.gallery': 'Galería', 'nav.contact': 'Contacto',
    'nav.pricing': 'Precios', 'nav.signin': 'Entrar', 'nav.register': 'Únete', 'nav.dashboard': 'Panel',
    'nav.logout': 'Salir', 'nav.menu': 'Menú',
    'hero.badge': 'Presente en 3 países · 500+ socios por club',
    'hero.title': 'Entrena más duro. Gestiona más inteligente.',
    'hero.sub': 'GymFlow es el sistema operativo para centros de fitness a gran escala: socios, clases, entrenadores, equipamiento, TPV y analítica en una sola consola.',
    'hero.cta1': 'Empezar membresía', 'hero.cta2': 'Ver la plataforma', 'hero.scroll': 'Desliza para explorar',
    'stats.members': 'Socios activos', 'stats.classes': 'Clases / semana', 'stats.trainers': 'Entrenadores certificados', 'stats.locations': 'Clubes',
    'modules.title': 'Diez módulos. Un centro de control.',
    'modules.sub': 'Todo lo que necesita un club con más de 500 socios — de recepción a finanzas — pensado para operarse un sábado concurrido.',
    'classes.title': 'El horario nunca duerme', 'classes.sub': 'Sesiones reales, aforo real y lista de espera real, reservables en dos toques.',
    'classes.book': 'Reservar', 'classes.booked': 'Reservado', 'classes.seats': 'plazas libres',
    'gallery.title': 'Dentro de las instalaciones', 'gallery.sub': 'Doce mil metros cuadrados sin espacio muerto.', 'gallery.view': 'Ver galería',
    'pricing.title': 'Una membresía que crece contigo', 'pricing.sub': 'Precios base en USD. Cambia divisa y país en la cabecera.',
    'pricing.month': '/mes', 'pricing.popular': 'Más popular', 'pricing.choose': 'Elegir plan',
    'reviews.title': '4.9 de quienes realmente entrenan', 'reviews.sub': 'Opiniones verificadas de socios en Bengaluru, Austin y Berlín.',
    'cta.title': 'Tu sala, tus datos, tus reglas.', 'cta.text': 'Activa una consola completa con datos de demostración en menos de un minuto.', 'cta.button': 'Abrir la consola',
    'about.title': 'Creado por operadores, no por propietarios', 'about.sub': 'GymFlow nació de una hoja de cálculo que se negaba a morir.',
    'about.story': 'Nuestra historia', 'about.values': 'Principios operativos', 'about.team': 'El equipo', 'about.mission': 'Misión', 'about.vision': 'Visión',
    'about.missionText': 'Dar a cada operador herramientas de nivel empresarial sin la complejidad empresarial.',
    'about.visionText': 'Un mundo donde dirigir un gimnasio sea tan gratificante como entrenar en uno.',
    'contact.title': 'Habla con el equipo', 'contact.sub': 'Ventas, soporte o alianzas — una persona responde en 24 horas.',
    'contact.name': 'Tu nombre', 'contact.email': 'Correo electrónico', 'contact.phone': 'Teléfono (opcional)', 'contact.subject': 'Asunto',
    'contact.message': '¿Cómo podemos ayudar?', 'contact.send': 'Enviar mensaje', 'contact.sent': 'Mensaje enviado — respondemos en 24 horas.',
    'contact.info': 'Sede', 'contact.hours': 'Horario de soporte', 'contact.hoursValue': 'Lun–Dom · 05:00 a 23:00 hora local',
    'auth.signin': 'Iniciar sesión', 'auth.register': 'Crear cuenta', 'auth.email': 'Correo electrónico', 'auth.password': 'Contraseña',
    'auth.name': 'Nombre completo', 'auth.have': '¿Ya tienes cuenta?', 'auth.no': '¿Nuevo en GymFlow?',
    'auth.submitSignin': 'Entrar a la consola', 'auth.submitRegister': 'Crear mi membresía', 'auth.demo': 'Accesos demo',
    'auth.demoHint': 'admin@gymflow.io / admin123 · socios usan member123',
    'footer.tagline': 'El sistema operativo de las instalaciones fitness modernas.',
    'footer.product': 'Producto', 'footer.company': 'Empresa', 'footer.legal': 'Legal', 'footer.rights': 'Todos los derechos reservados.',
    'common.loading': 'Cargando…', 'common.search': 'Buscar…', 'common.viewAll': 'Ver todo', 'common.learnMore': 'Saber más',
    'common.perMonth': 'al mes', 'common.close': 'Cerrar', 'common.country': 'País y divisa', 'common.language': 'Idioma',
  },
  fr: {
    'nav.home': 'Accueil', 'nav.about': 'À propos', 'nav.gallery': 'Galerie', 'nav.contact': 'Contact',
    'nav.pricing': 'Tarifs', 'nav.signin': 'Connexion', 'nav.register': 'Rejoindre', 'nav.dashboard': 'Console',
    'nav.logout': 'Déconnexion', 'nav.menu': 'Menu',
    'hero.badge': 'Présent dans 3 pays · 500+ adhérents par club',
    'hero.title': 'Entraînez plus fort. Gérez plus malin.',
    'hero.sub': 'GymFlow est le système d’exploitation des grandes installations de fitness : adhérents, cours, coachs, matériel, caisse et analytique dans une seule console.',
    'hero.cta1': 'Créer mon adhésion', 'hero.cta2': 'Découvrir la plateforme', 'hero.scroll': 'Faites défiler',
    'stats.members': 'Adhérents actifs', 'stats.classes': 'Cours / semaine', 'stats.trainers': 'Coachs certifiés', 'stats.locations': 'Clubs',
    'modules.title': 'Dix modules. Un seul poste de pilotage.',
    'modules.sub': 'Tout ce qu’exige un club de plus de 500 adhérents — de l’accueil à la finance — conçu pour un samedi chargé.',
    'classes.title': 'L’emploi du temps ne dort jamais', 'classes.sub': 'Séances réelles, places réelles, liste d’attente réelle — réservables en deux clics.',
    'classes.book': 'Réserver', 'classes.booked': 'Réservé', 'classes.seats': 'places restantes',
    'gallery.title': 'Dans les installations', 'gallery.sub': 'Douze mille mètres carrés, aucun espace mort.', 'gallery.view': 'Voir la galerie',
    'pricing.title': 'Une adhésion qui grandit avec vous', 'pricing.sub': 'Prix de base en USD. Changez devise et pays dans l’en-tête.',
    'pricing.month': '/mois', 'pricing.popular': 'Le plus choisi', 'pricing.choose': 'Choisir',
    'reviews.title': 'Noté 4,9 par ceux qui s’entraînent vraiment', 'reviews.sub': 'Avis vérifiés de membres à Bengaluru, Austin et Berlin.',
    'cta.title': 'Vos salles, vos données, vos règles.', 'cta.text': 'Lancez une console complète avec données de démo en moins d’une minute.',
    'cta.button': 'Ouvrir la console',
    'about.title': 'Conçu par des opérateurs, pas des propriétaires', 'about.sub': 'GymFlow est né d’un tableur qui refusait de mourir.',
    'about.story': 'Notre histoire', 'about.values': 'Principes opérationnels', 'about.team': 'L’équipe', 'about.mission': 'Mission', 'about.vision': 'Vision',
    'about.missionText': 'Donner à chaque opérateur des outils de niveau entreprise sans la complexité entreprise.',
    'about.visionText': 'Un monde où gérer une salle est aussi gratifiant que de s’y entraîner.',
    'contact.title': 'Parlez à l’équipe', 'contact.sub': 'Vente, support ou partenariats — un humain répond sous 24 h.',
    'contact.name': 'Votre nom', 'contact.email': 'Adresse e-mail', 'contact.phone': 'Téléphone (facultatif)', 'contact.subject': 'Sujet',
    'contact.message': 'Comment pouvons-nous aider ?', 'contact.send': 'Envoyer', 'contact.sent': 'Message envoyé — réponse sous 24 h.',
    'contact.info': 'Siège', 'contact.hours': 'Support', 'contact.hoursValue': 'Lun–Dim · 05:00 à 23:00 heure locale',
    'auth.signin': 'Connexion', 'auth.register': 'Créer un compte', 'auth.email': 'Adresse e-mail', 'auth.password': 'Mot de passe',
    'auth.name': 'Nom complet', 'auth.have': 'Déjà un compte ?', 'auth.no': 'Nouveau sur GymFlow ?',
    'auth.submitSignin': 'Entrer dans la console', 'auth.submitRegister': 'Créer mon adhésion', 'auth.demo': 'Comptes démo',
    'auth.demoHint': 'admin@gymflow.io / admin123 · membres : member123',
    'footer.tagline': 'Le système d’exploitation des installations fitness modernes.',
    'footer.product': 'Produit', 'footer.company': 'Entreprise', 'footer.legal': 'Mentions légales', 'footer.rights': 'Tous droits réservés.',
    'common.loading': 'Chargement…', 'common.search': 'Rechercher…', 'common.viewAll': 'Tout voir', 'common.learnMore': 'En savoir plus',
    'common.perMonth': 'par mois', 'common.close': 'Fermer', 'common.country': 'Pays et devise', 'common.language': 'Langue',
  },
  de: {
    'nav.home': 'Start', 'nav.about': 'Über uns', 'nav.gallery': 'Galerie', 'nav.contact': 'Kontakt',
    'nav.pricing': 'Preise', 'nav.signin': 'Anmelden', 'nav.register': 'Mitglied werden', 'nav.dashboard': 'Konsole',
    'nav.logout': 'Abmelden', 'nav.menu': 'Menü',
    'hero.badge': 'In 3 Ländern aktiv · 500+ Mitglieder pro Club',
    'hero.title': 'Trainiere härter. Verwalte cleverer.',
    'hero.sub': 'GymFlow ist das Betriebssystem für große Fitnessstudios — Mitglieder, Kurse, Trainer, Geräte, Kasse und Analysen in einer Konsole.',
    'hero.cta1': 'Mitgliedschaft starten', 'hero.cta2': 'Plattform entdecken', 'hero.scroll': 'Scrollen',
    'stats.members': 'Aktive Mitglieder', 'stats.classes': 'Kurse / Woche', 'stats.trainers': 'Zertifizierte Trainer', 'stats.locations': 'Clubs',
    'modules.title': 'Zehn Module. Ein Kommandozentrum.',
    'modules.sub': 'Alles, was ein Club mit über 500 Mitgliedern braucht — vom Empfang bis zur Buchhaltung — für den vollen Samstag gebaut.',
    'classes.title': 'Der Plan schläft nie', 'classes.sub': 'Echte Sessions, echte Kapazität, echte Wartelisten — in zwei Klicks buchbar.',
    'classes.book': 'Buchen', 'classes.booked': 'Gebucht', 'classes.seats': 'Plätze frei',
    'gallery.title': 'In den Studios', 'gallery.sub': 'Zwölftausend Quadratmeter ohne tote Ecke.', 'gallery.view': 'Galerie öffnen',
    'pricing.title': 'Mitgliedschaft, die mitwächst', 'pricing.sub': 'Basispreise in USD. Währung und Land im Header wechseln.',
    'pricing.month': '/Monat', 'pricing.popular': 'Am beliebtesten', 'pricing.choose': 'Plan wählen',
    'reviews.title': '4,9 von Menschen, die wirklich trainieren', 'reviews.sub': 'Verifizierte Bewertungen aus Bengaluru, Austin und Berlin.',
    'cta.title': 'Dein Studio, deine Daten, deine Regeln.', 'cta.text': 'Starte eine vollständige Konsole mit Demo-Daten in unter einer Minute.',
    'cta.button': 'Konsole öffnen',
    'about.title': 'Gebaut von Betreibern, nicht von Vermietern', 'about.sub': 'GymFlow begann als Tabellenkalkulation, die nicht sterben wollte.',
    'about.story': 'Unsere Geschichte', 'about.values': 'Betriebsprinzipien', 'about.team': 'Das Team', 'about.mission': 'Mission', 'about.vision': 'Vision',
    'about.missionText': 'Jedem Betreiber Unternehmenswerkzeuge ohne Unternehmenskomplexität geben.',
    'about.visionText': 'Eine Welt, in der Studioführung genauso befriedigend ist wie das Training darin.',
    'contact.title': 'Sprich mit dem Team', 'contact.sub': 'Vertrieb, Support oder Partnerschaften — ein Mensch antwortet in 24 Stunden.',
    'contact.name': 'Dein Name', 'contact.email': 'E-Mail-Adresse', 'contact.phone': 'Telefon (optional)', 'contact.subject': 'Betreff',
    'contact.message': 'Wie können wir helfen?', 'contact.send': 'Nachricht senden', 'contact.sent': 'Gesendet — Antwort in 24 Stunden.',
    'contact.info': 'Hauptsitz', 'contact.hours': 'Supportzeiten', 'contact.hoursValue': 'Mo–So · 05:00 bis 23:00 Ortszeit',
    'auth.signin': 'Anmelden', 'auth.register': 'Konto erstellen', 'auth.email': 'E-Mail-Adresse', 'auth.password': 'Passwort',
    'auth.name': 'Vollständiger Name', 'auth.have': 'Schon ein Konto?', 'auth.no': 'Neu bei GymFlow?',
    'auth.submitSignin': 'Zur Konsole', 'auth.submitRegister': 'Mitgliedschaft erstellen', 'auth.demo': 'Demo-Zugänge',
    'auth.demoHint': 'admin@gymflow.io / admin123 · Mitglieder: member123',
    'footer.tagline': 'Das Betriebssystem moderner Fitnessstudios.',
    'footer.product': 'Produkt', 'footer.company': 'Unternehmen', 'footer.legal': 'Rechtliches', 'footer.rights': 'Alle Rechte vorbehalten.',
    'common.loading': 'Lädt…', 'common.search': 'Suchen…', 'common.viewAll': 'Alle', 'common.learnMore': 'Mehr erfahren',
    'common.perMonth': 'pro Monat', 'common.close': 'Schließen', 'common.country': 'Land & Währung', 'common.language': 'Sprache',
  },
  hi: {
    'nav.home': 'होम', 'nav.about': 'हमारे बारे में', 'nav.gallery': 'गैलरी', 'nav.contact': 'संपर्क',
    'nav.pricing': 'प्लान', 'nav.signin': 'साइन इन', 'nav.register': 'जुड़ें', 'nav.dashboard': 'डैशबोर्ड',
    'nav.logout': 'लॉग आउट', 'nav.menu': 'मेन्यू',
    'hero.badge': '3 देशों में उपस्थित · हर क्लब में 500+ सदस्य',
    'hero.title': 'ज़्यादा मेहनत। बेहतर प्रबंधन।',
    'hero.sub': 'GymFlow बड़े फिटनेस सेंटर्स का ऑपरेटिंग सिस्टम है — मेंबरशिप, क्लास, ट्रेनर, उपकरण, POS और एनालिटिक्स एक ही कंसोल में।',
    'hero.cta1': 'मेंबरशिप शुरू करें', 'hero.cta2': 'प्लेटफ़ॉर्म देखें', 'hero.scroll': 'स्क्रॉल करें',
    'stats.members': 'सक्रिय सदस्य', 'stats.classes': 'क्लास / सप्ताह', 'stats.trainers': 'प्रमाणित कोच', 'stats.locations': 'क्लब लोकेशन',
    'modules.title': 'दस मॉड्यूल। एक कमांड सेंटर।',
    'modules.sub': '500+ सदस्यों वाले क्लब के लिए ज़रूरी सब कुछ — फ्रंट डेस्क से लेकर फाइनेंस तक — व्यस्त शनिवार के लिए बनाया गया।',
    'classes.title': 'समय-सारणी कभी नहीं सोती', 'classes.sub': 'असली सेशन, असली सीटें, असली वेटलिस्ट — दो टैप में बुकिंग।',
    'classes.book': 'बुक करें', 'classes.booked': 'बुक्ड', 'classes.seats': 'सीट शेष',
    'gallery.title': 'सुविधाओं के भीतर', 'gallery.sub': 'बारह हज़ार वर्ग फुट, एक भी बेकार जगह नहीं।', 'gallery.view': 'गैलरी देखें',
    'pricing.title': 'ऐसी मेंबरशिप जो आपके साथ बढ़े', 'pricing.sub': 'आधार कीमत अमेरिकी डॉलर में। हेडर से मुद्रा और देश बदलें।',
    'pricing.month': '/माह', 'pricing.popular': 'सबसे लोकप्रिय', 'pricing.choose': 'प्लान चुनें',
    'reviews.title': 'असली मेहनत करने वालों ने 4.9 दिए', 'reviews.sub': 'बेंगलुरु, ऑस्टिन और बर्लिन के सदस्यों की सत्यापित राय।',
    'cta.title': 'आपका फ्लोर, आपका डेटा, आपके नियम।', 'cta.text': 'एक मिनट से भी कम समय में पूरा डेमो कंसोल खोलें।',
    'cta.button': 'कंसोल खोलें',
    'about.title': 'मालिकों ने नहीं, ऑपरेटरों ने बनाया', 'about.sub': 'GymFlow एक स्प्रेडशीट से शुरू हुआ जो मरना नहीं चाहता था।',
    'about.story': 'हमारी कहानी', 'about.values': 'संचालन के सिद्धांत', 'about.team': 'टीम', 'about.mission': 'मिशन', 'about.vision': 'विज़न',
    'about.missionText': 'हर ऑपरेटर को एंटरप्राइज़-स्तर के टूल बिना जटिलता के देना।',
    'about.visionText': 'एक ऐसी दुनिया जहां जिम चलाना उतना ही संतोषजनक हो जितना उसमें ट्रेन करना।',
    'contact.title': 'टीम से बात करें', 'contact.sub': 'सेल्स, सपोर्ट या पार्टनरशिप — 24 घंटे में जवाब मिलेगा।',
    'contact.name': 'आपका नाम', 'contact.email': 'ईमेल', 'contact.phone': 'फ़ोन (वैकल्पिक)', 'contact.subject': 'विषय',
    'contact.message': 'हम कैसे मदद करें?', 'contact.send': 'संदेश भेजें', 'contact.sent': 'संदेश भेजा गया — 24 घंटे में उत्तर।',
    'contact.info': 'मुख्यालय', 'contact.hours': 'सपोर्ट समय', 'contact.hoursValue': 'सोम–रवि · स्थानीय समय 05:00 से 23:00',
    'auth.signin': 'साइन इन', 'auth.register': 'खाता बनाएँ', 'auth.email': 'ईमेल पता', 'auth.password': 'पासवर्ड',
    'auth.name': 'पूरा नाम', 'auth.have': 'पहले से खाता है?', 'auth.no': 'GymFlow पर नए हैं?',
    'auth.submitSignin': 'कंसोल में जाएँ', 'auth.submitRegister': 'मेंबरशिप बनाएँ', 'auth.demo': 'डेमो लॉगिन',
    'auth.demoHint': 'admin@gymflow.io / admin123 · सदस्य: member123',
    'footer.tagline': 'आधुनिक फिटनेस सेंटर्स का ऑपरेटिंग सिस्टम।',
    'footer.product': 'प्रोडक्ट', 'footer.company': 'कंपनी', 'footer.legal': 'कानूनी', 'footer.rights': 'सर्वाधिकार सुरक्षित।',
    'common.loading': 'लोड हो रहा है…', 'common.search': 'खोजें…', 'common.viewAll': 'सभी देखें', 'common.learnMore': 'और जानें',
    'common.perMonth': 'प्रति माह', 'common.close': 'बंद करें', 'common.country': 'देश और मुद्रा', 'common.language': 'भाषा',
  },
  ar: {
    'nav.home': 'الرئيسية', 'nav.about': 'من نحن', 'nav.gallery': 'المعرض', 'nav.contact': 'اتصل بنا',
    'nav.pricing': 'الأسعار', 'nav.signin': 'تسجيل الدخول', 'nav.register': 'اشترك', 'nav.dashboard': 'لوحة التحكم',
    'nav.logout': 'خروج', 'nav.menu': 'القائمة',
    'hero.badge': 'في ٣ دول · أكثر من ٥٠٠ عضو لكل نادٍ',
    'hero.title': 'تدرّب بقوة. وأدِر بذكاء.',
    'hero.sub': 'GymFlow هو نظام تشغيل منشآت اللياقة الكبيرة — العضويات والدورات والمدربون والمعدات ونقاط البيع والتحليلات في وحدة واحدة.',
    'hero.cta1': 'ابدأ عضويتك', 'hero.cta2': 'استكشف المنصة', 'hero.scroll': 'مرّر للاستكشاف',
    'stats.members': 'أعضاء نشطون', 'stats.classes': 'حصص / أسبوع', 'stats.trainers': 'مدربون معتمدون', 'stats.locations': 'فروع',
    'modules.title': 'عشر وحدات. مركز قيادة واحد.',
    'modules.sub': 'كل ما يحتاجه نادٍ بأكثر من ٥٠٠ عضو — من الاستقبال إلى المالية — مصمّم للعمل في يوم سبت مزدحم.',
    'classes.title': 'الجدول لا ينام أبدًا', 'classes.sub': 'حصص حقيقية وسعة حقيقية وقوف انتظار حقيقي — الحجز بضغعتين.',
    'classes.book': 'احجز مقعدًا', 'classes.booked': 'تم الحجز', 'classes.seats': 'مقاعد متبقية',
    'gallery.title': 'داخل المرافق', 'gallery.sub': 'اثنا عشر ألف قدم مربع بلا مساحة ضائعة.', 'gallery.view': 'افتح المعرض',
    'pricing.title': 'عضوية تنمو معك', 'pricing.sub': 'الأسعار الأساسية بالدولار الأمريكي. غيّر العملة والدولة من الترويسة.',
    'pricing.month': '/شهريًا', 'pricing.popular': 'الأكثر شيوعًا', 'pricing.choose': 'اختر الباقة',
    'reviews.title': 'تقييم ٤٫٩ من يتدربون فعلًا', 'reviews.sub': 'آراء موثّقة من أعضاء في بنغالور وأوستن وبرلين.',
    'cta.title': 'نزلك، بياناتك، قواعدك.', 'cta.text': 'شغّل لوحة تشغيل كاملة ببيانات تجريبية في أقل من دقيقة.',
    'cta.button': 'افتح اللوحة',
    'about.title': 'بناه مشغّلون لا مالكون', 'about.sub': 'بدأ GymFlow كملف جدول بيانات رفض أن يموت.',
    'about.story': 'قصتنا', 'about.values': 'مبادئ التشغيل', 'about.team': 'الفريق', 'about.mission': 'الرسالة', 'about.vision': 'الرؤية',
    'about.missionText': 'منح كل مشغّل أدوات بمستوى المؤسسات دون تعقيد المؤسسات.',
    'about.visionText': 'عالم يكون فيه إدارة النادي بمتعة التدريب فيه.',
    'contact.title': 'تحدّث إلى الفريق', 'contact.sub': 'المبيعات أو الدعم أو الشراكات — يردّ عليك شخص خلال ٢٤ ساعة.',
    'contact.name': 'اسمك', 'contact.email': 'البريد الإلكتروني', 'contact.phone': 'الهاتف (اختياري)', 'contact.subject': 'الموضوع',
    'contact.message': 'كيف يمكننا المساعدة؟', 'contact.send': 'إرسال الرسالة', 'contact.sent': 'تم الإرسال — سنرد خلال ٢٤ ساعة.',
    'contact.info': 'المقر الرئيسي', 'contact.hours': 'ساعات الدعم', 'contact.hoursValue': 'الاثنين–الأحد · ٠٥:٠٠ حتى ٢٣:٠٠ بتوقيت محلي',
    'auth.signin': 'تسجيل الدخول', 'auth.register': 'إنشاء حساب', 'auth.email': 'البريد الإلكتروني', 'auth.password': 'كلمة المرور',
    'auth.name': 'الاسم الكامل', 'auth.have': 'لديك حساب بالفعل؟', 'auth.no': 'جديد على GymFlow؟',
    'auth.submitSignin': 'ادخل إلى اللوحة', 'auth.submitRegister': 'أنشئ عضويتك', 'auth.demo': 'حسابات تجريبية',
    'auth.demoHint': 'admin@gymflow.io / admin123 · الأعضاء: member123',
    'footer.tagline': 'نظام تشغيل منشآت اللياقة الحديثة.',
    'footer.product': 'المنتج', 'footer.company': 'الشركة', 'footer.legal': 'قانوني', 'footer.rights': 'جميع الحقوق محفوظة.',
    'common.loading': 'جارٍ التحميل…', 'common.search': 'بحث…', 'common.viewAll': 'عرض الكل', 'common.learnMore': 'اعرف المزيد',
    'common.perMonth': 'شهريًا', 'common.close': 'إغلاق', 'common.country': 'الدولة والعملة', 'common.language': 'اللغة',
  },
};

const LocaleContext = createContext(null);

const readStore = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export function LocaleProvider({ children }) {
  const [lang, setLang] = useState(() => readStore('gf.lang', (navigator.language || 'en').slice(0, 2)));
  const [currency, setCurrency] = useState(() => readStore('gf.currency', ''));
  const [country, setCountry] = useState(() => readStore('gf.country', ''));

  useEffect(() => {
    if (!DICT[lang]) setLang('en');
  }, [lang]);

  useEffect(() => {
    if (currency) return;
    try {
      const loc = new Intl.Locale(navigator.language);
      const region = loc.maximize().region;
      const byRegion = { US: 'USD', IN: 'INR', GB: 'GBP', DE: 'EUR', FR: 'EUR', ES: 'EUR', JP: 'JPY', BR: 'BRL', AE: 'AED', AU: 'AUD', CA: 'CAD', SG: 'SGD', ZA: 'ZAR', MX: 'MXN' };
      const code = byRegion[region] || 'USD';
      setCurrency(code);
      setCountry(region || 'US');
      localStorage.setItem('gf.currency', code);
      localStorage.setItem('gf.country', region || 'US');
    } catch {
      setCurrency('USD');
    }
  }, [currency]);

  const dir = LANGUAGES.find((l) => l.code === lang)?.dir || 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body.setAttribute('dir', dir);
    localStorage.setItem('gf.lang', lang);
  }, [lang, dir]);

  const t = useCallback((key) => DICT[lang]?.[key] ?? EN[key] ?? key, [lang]);

  const money = useCallback(
    (usd, opts = {}) => {
      const cur = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
      const value = Number(usd || 0) * cur.rate;
      const localeMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', hi: 'hi-IN', ar: 'ar-AE' };
      try {
        return new Intl.NumberFormat(localeMap[lang] || 'en-US', {
          style: 'currency',
          currency: cur.code,
          maximumFractionDigits: opts.decimals ?? (value >= 1000 ? 0 : 0),
        }).format(value);
      } catch {
        return `${cur.symbol}${Math.round(value).toLocaleString()}`;
      }
    },
    [currency, lang]
  );

  const date = useCallback(
    (value, opts = {}) => {
      const localeMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', hi: 'hi-IN', ar: 'ar-AE' };
      const d = value ? new Date(value) : new Date();
      if (Number.isNaN(d.getTime())) return '—';
      const o = { day: '2-digit', month: 'short', year: 'numeric' };
      Object.entries(opts).forEach(([k, v]) => {
        if (v === false) delete o[k];
        else if (v === true) o[k] = ['year', 'month', 'day'].includes(k) ? 'numeric' : true;
        else o[k] = v;
      });
      return new Intl.DateTimeFormat(localeMap[lang] || 'en-US', o).format(d);
    },
    [lang]
  );

  const setLocale = useCallback((next = {}) => {
    if (next.lang) {
      setLang(next.lang);
      localStorage.setItem('gf.lang', next.lang);
    }
    if (next.currency) {
      setCurrency(next.currency);
      localStorage.setItem('gf.currency', next.currency);
    }
    if (next.country) {
      setCountry(next.country);
      localStorage.setItem('gf.country', next.country);
    }
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, currency, setCurrency, country, setCountry, setLocale, t, money, date, dir, languages: LANGUAGES, currencies: CURRENCIES }),
    [lang, currency, country, setLocale, t, money, date, dir]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
};
