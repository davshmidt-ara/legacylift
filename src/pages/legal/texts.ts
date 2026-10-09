// Privacy policy and terms of use, in every language LegacyLift is offered in.
// {operator} and {contact} are filled in from src/config/company.ts.
import type { Lang } from "@/i18n";

export interface LegalDoc {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

export interface LegalTexts {
  privacy: LegalDoc;
  terms: LegalDoc;
  updated: string;
  operatorFallback: string;
  contactFallback: string;
  back: string;
}

export const LEGAL: Record<Lang, LegalTexts> = {
  en: {
    updated: "Last updated: {date}",
    operatorFallback: "the operator of LegacyLift",
    contactFallback: "through your LegacyLift adviser",
    back: "Back to LegacyLift",
    privacy: {
      title: "Privacy policy",
      intro: "This policy explains what information LegacyLift keeps about you and your business, why, who can see it, and what you can do about it. LegacyLift is run by {operator}. Questions and requests: {contact}.",
      sections: [
        {
          heading: "What we keep",
          body: [
            "Your account: your name, email address, how you sign in (email and password, Google or Microsoft), when you signed up and last signed in, and the language you use. If you sign in with Google or Microsoft, they share only your name and email address with us. We never see or store your Google or Microsoft password; email passwords are stored only in protected, scrambled form by our database provider.",
            "Your business data: everything you enter or upload in your workspace — business details, customers, invoices and quotes, stock, digitized documents, notes and AI conversations.",
            "Technical data: a sign-in token kept in your browser so you stay signed in, and your language choice. We use no advertising or tracking cookies.",
          ],
        },
        {
          heading: "Why we keep it",
          body: [
            "To provide LegacyLift to you under our agreement with you (GDPR Art. 6(1)(b)), to keep the service secure and prevent misuse (our legitimate interest, Art. 6(1)(f)), and to meet legal obligations such as accounting rules (Art. 6(1)(c)).",
            "Your customers' details in your workspace belong to you: for them you decide what is kept and why, and we process them on your behalf only to run LegacyLift for you.",
          ],
        },
        {
          heading: "Who can see it",
          body: [
            "You, and people you or your LegacyLift adviser give access to your business. Our team, to set up and support your workspace. Nobody else. Other clients never see your data, and the list of accounts is visible only to our team. We do not sell your data or use it for advertising.",
          ],
        },
        {
          heading: "Services we use",
          body: [
            "Supabase (database and sign-in), with your data stored in the European Union (Frankfurt, Germany). GitHub Pages, which only serves the website's files and never receives your business data. Google or Microsoft, only if you choose to sign in with them. Anthropic (Claude), when you use AI features: the text or file you give the AI and the business data needed for the answer are sent to it to produce the result; under Anthropic's commercial terms this is not used to train AI models. An email service, to send sign-in emails.",
          ],
        },
        {
          heading: "How long we keep it",
          body: [
            "As long as your account exists. When you delete your account, it is removed straight away, together with any business you set up yourself and share with nobody else. Copies may remain in our provider's backups for up to 30 days. Records we must keep by law are kept only as long as the law requires.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You can see and correct your data in LegacyLift at any time, download all of it (Settings → Download backup), and delete your account (Settings → Your account). You can also ask us for access, correction, deletion, restriction, a copy to take elsewhere, or object to processing: {contact}.",
            "You may complain to a data protection authority: in Latvia the Datu valsts inspekcija (dvi.gov.lv), in Lithuania the Valstybinė duomenų apsaugos inspekcija (vdai.lrv.lt), in Estonia the Andmekaitse Inspektsioon (aki.ee).",
          ],
        },
        {
          heading: "Changes",
          body: ["If this policy changes in a way that matters to you, we will tell you in LegacyLift or by email before the change applies."],
        },
      ],
    },
    terms: {
      title: "Terms of use",
      intro: "These terms apply when you use LegacyLift, provided by {operator}. By creating an account you agree to them. Questions: {contact}.",
      sections: [
        { heading: "The service", body: ["LegacyLift is an online workspace for invoicing, customers, stock, documents and AI help for established businesses. We may improve and change it over time."] },
        {
          heading: "Your account",
          body: [
            "Give correct details and keep your sign-in safe. You are responsible for what happens in your account and for the people you give access to your business. Tell us straight away if you think someone else is using your account.",
          ],
        },
        {
          heading: "Your data",
          body: [
            "Your business data stays yours. You may download it at any time and take it elsewhere. You are responsible for having the right to enter the personal data of your customers and contacts, and we handle it as described in the privacy policy.",
          ],
        },
        {
          heading: "Invoices, taxes and AI",
          body: [
            "You are responsible for the invoices you issue and for meeting tax, VAT and accounting rules. AI results are suggestions: check them before you save, send or rely on them. LegacyLift does not give legal, tax or financial advice.",
          ],
        },
        {
          heading: "Availability",
          body: ["We work to keep LegacyLift running and your data safe, but cannot promise it will always be available or free of errors. Keep your own backups of important data (Settings → Download backup)."],
        },
        { heading: "Fees", body: ["Trying LegacyLift is free. Paid packages and their prices are agreed with you separately before anything is charged."] },
        {
          heading: "Ending",
          body: [
            "You can stop at any time and delete your account in Settings. We may suspend accounts that are misused or that put the service or other users at risk, and will tell you why where we can.",
          ],
        },
        {
          heading: "Liability and law",
          body: [
            "Our liability is limited as far as the law allows; nothing in these terms limits rights you have as a consumer. Applicable law: the law of {country}. If these terms change, we will tell you before the change applies.",
          ],
        },
      ],
    },
  },

  lv: {
    updated: "Pēdējās izmaiņas: {date}",
    operatorFallback: "LegacyLift uzturētājs",
    contactFallback: "ar sava LegacyLift konsultanta starpniecību",
    back: "Atpakaļ uz LegacyLift",
    privacy: {
      title: "Privātuma politika",
      intro: "Šajā politikā skaidrots, kādu informāciju par jums un jūsu uzņēmumu glabā LegacyLift, kāpēc, kas to var redzēt un ko jūs varat darīt. LegacyLift uztur {operator}. Jautājumi un pieprasījumi: {contact}.",
      sections: [
        {
          heading: "Ko mēs glabājam",
          body: [
            "Jūsu konts: vārds, e-pasta adrese, pierakstīšanās veids (e-pasts un parole, Google vai Microsoft), reģistrēšanās un pēdējās pierakstīšanās laiks un izmantotā valoda. Ja pierakstāties ar Google vai Microsoft, tie mums nodod tikai jūsu vārdu un e-pasta adresi. Mēs nekad neredzam un neglabājam jūsu Google vai Microsoft paroli; e-pasta paroles mūsu datubāzes pakalpojuma sniedzējs glabā tikai aizsargātā, šifrētā veidā.",
            "Jūsu uzņēmuma dati: viss, ko ievadāt vai augšupielādējat savā darba vietā — uzņēmuma dati, klienti, rēķini un piedāvājumi, krājumi, digitalizētie dokumenti, piezīmes un sarunas ar AI.",
            "Tehniskie dati: pierakstīšanās atslēga jūsu pārlūkā, lai jūs paliktu pierakstījies, un jūsu valodas izvēle. Mēs neizmantojam reklāmas vai izsekošanas sīkdatnes.",
          ],
        },
        {
          heading: "Kāpēc mēs to glabājam",
          body: [
            "Lai nodrošinātu jums LegacyLift saskaņā ar mūsu vienošanos (VDAR 6. panta 1. punkta b) apakšpunkts), lai pakalpojums būtu drošs un novērstu ļaunprātīgu izmantošanu (mūsu leģitīmās intereses, f) apakšpunkts) un lai izpildītu juridiskos pienākumus, piemēram, grāmatvedības prasības (c) apakšpunkts).",
            "Jūsu klientu dati jūsu darba vietā pieder jums: jūs nosakāt, kas tiek glabāts un kāpēc, un mēs tos apstrādājam jūsu vārdā tikai, lai nodrošinātu jums LegacyLift.",
          ],
        },
        {
          heading: "Kas to var redzēt",
          body: [
            "Jūs un cilvēki, kuriem jūs vai jūsu LegacyLift konsultants piešķirat piekļuvi jūsu uzņēmumam. Mūsu komanda — lai iekārtotu un atbalstītu jūsu darba vietu. Neviens cits. Citi klienti nekad neredz jūsu datus, un kontu sarakstu redz tikai mūsu komanda. Mēs nepārdodam jūsu datus un neizmantojam tos reklāmai.",
          ],
        },
        {
          heading: "Pakalpojumi, ko izmantojam",
          body: [
            "Supabase (datubāze un pierakstīšanās), jūsu dati tiek glabāti Eiropas Savienībā (Frankfurtē, Vācijā). GitHub Pages, kas tikai nodrošina mājaslapas failus un nekad nesaņem jūsu uzņēmuma datus. Google vai Microsoft — tikai, ja izvēlaties pierakstīties ar tiem. Anthropic (Claude), kad izmantojat AI funkcijas: AI tiek nosūtīts jūsu dotais teksts vai fails un atbildei nepieciešamie uzņēmuma dati; saskaņā ar Anthropic komerciālajiem noteikumiem tie netiek izmantoti AI modeļu apmācībai. E-pasta pakalpojums pierakstīšanās vēstuļu sūtīšanai.",
          ],
        },
        {
          heading: "Cik ilgi mēs to glabājam",
          body: [
            "Kamēr pastāv jūsu konts. Kad dzēšat kontu, tas tiek dzēsts nekavējoties kopā ar uzņēmumu, ko pats izveidojāt un nedalāt ne ar vienu citu. Kopijas var saglabāties mūsu pakalpojuma sniedzēja rezerves kopijās līdz 30 dienām. Ierakstus, kas jāglabā saskaņā ar likumu, glabājam tikai tik ilgi, cik to prasa likums.",
          ],
        },
        {
          heading: "Jūsu tiesības",
          body: [
            "Jūs jebkurā laikā varat skatīt un labot savus datus LegacyLift, lejupielādēt tos visus (Iestatījumi → Lejupielādēt rezerves kopiju) un dzēst savu kontu (Iestatījumi → Jūsu konts). Varat arī lūgt mums piekļuvi, labošanu, dzēšanu, ierobežošanu, kopiju pārnešanai vai iebilst pret apstrādi: {contact}.",
            "Jūs varat iesniegt sūdzību datu aizsardzības iestādei: Latvijā — Datu valsts inspekcijai (dvi.gov.lv), Lietuvā — Valstybinė duomenų apsaugos inspekcija (vdai.lrv.lt), Igaunijā — Andmekaitse Inspektsioon (aki.ee).",
          ],
        },
        { heading: "Izmaiņas", body: ["Ja šī politika mainīsies jums būtiskā veidā, mēs jums par to paziņosim LegacyLift vai pa e-pastu pirms izmaiņu stāšanās spēkā."] },
      ],
    },
    terms: {
      title: "Lietošanas noteikumi",
      intro: "Šie noteikumi attiecas uz LegacyLift lietošanu, ko nodrošina {operator}. Izveidojot kontu, jūs tiem piekrītat. Jautājumi: {contact}.",
      sections: [
        { heading: "Pakalpojums", body: ["LegacyLift ir tiešsaistes darba vieta rēķiniem, klientiem, krājumiem, dokumentiem un AI palīdzībai uzņēmumiem ar vēsturi. Mēs to laika gaitā varam uzlabot un mainīt."] },
        { heading: "Jūsu konts", body: ["Norādiet pareizus datus un glabājiet pierakstīšanās datus drošībā. Jūs esat atbildīgs par to, kas notiek jūsu kontā, un par cilvēkiem, kuriem piešķirat piekļuvi savam uzņēmumam. Nekavējoties paziņojiet mums, ja domājat, ka jūsu kontu izmanto kāds cits."] },
        { heading: "Jūsu dati", body: ["Jūsu uzņēmuma dati paliek jūsu. Jūs jebkurā laikā varat tos lejupielādēt un pārnest citur. Jūs esat atbildīgs par tiesībām ievadīt savu klientu un kontaktpersonu personas datus, un mēs ar tiem rīkojamies, kā aprakstīts privātuma politikā."] },
        { heading: "Rēķini, nodokļi un AI", body: ["Jūs esat atbildīgs par saviem izrakstītajiem rēķiniem un par nodokļu, PVN un grāmatvedības prasību izpildi. AI rezultāti ir ieteikumi: pārbaudiet tos, pirms saglabājat, nosūtāt vai paļaujaties uz tiem. LegacyLift nesniedz juridiskas, nodokļu vai finanšu konsultācijas."] },
        { heading: "Pieejamība", body: ["Mēs strādājam, lai LegacyLift darbotos un jūsu dati būtu drošībā, taču nevaram apsolīt, ka tas vienmēr būs pieejams vai bez kļūdām. Glabājiet savas svarīgo datu rezerves kopijas (Iestatījumi → Lejupielādēt rezerves kopiju)."] },
        { heading: "Maksa", body: ["LegacyLift izmēģināšana ir bez maksas. Par maksas paketēm un to cenām ar jums vienojas atsevišķi, pirms tiek iekasēta jebkāda maksa."] },
        { heading: "Darbības beigšana", body: ["Jūs jebkurā laikā varat pārtraukt lietošanu un dzēst savu kontu iestatījumos. Mēs varam apturēt kontus, kas tiek izmantoti ļaunprātīgi vai apdraud pakalpojumu vai citus lietotājus, un, ja iespējams, paskaidrosim iemeslu."] },
        { heading: "Atbildība un tiesības", body: ["Mūsu atbildība ir ierobežota, ciktāl to atļauj likums; nekas šajos noteikumos neierobežo jūsu kā patērētāja tiesības. Piemērojamās tiesības: {country}. Ja šie noteikumi mainīsies, mēs jums par to paziņosim pirms izmaiņu stāšanās spēkā."] },
      ],
    },
  },

  lt: {
    updated: "Paskutinį kartą atnaujinta: {date}",
    operatorFallback: "LegacyLift valdytojas",
    contactFallback: "per savo LegacyLift konsultantą",
    back: "Atgal į LegacyLift",
    privacy: {
      title: "Privatumo politika",
      intro: "Šioje politikoje paaiškinama, kokią informaciją apie jus ir jūsų įmonę saugo LegacyLift, kodėl, kas gali ją matyti ir ką galite daryti. LegacyLift valdo {operator}. Klausimai ir prašymai: {contact}.",
      sections: [
        {
          heading: "Ką saugome",
          body: [
            "Jūsų paskyra: vardas, el. pašto adresas, prisijungimo būdas (el. paštas ir slaptažodis, Google arba Microsoft), registracijos ir paskutinio prisijungimo laikas bei naudojama kalba. Jei prisijungiate su Google ar Microsoft, jie mums perduoda tik jūsų vardą ir el. pašto adresą. Mes niekada nematome ir nesaugome jūsų Google ar Microsoft slaptažodžio; el. pašto slaptažodžius mūsų duomenų bazės paslaugų teikėjas saugo tik apsaugota, užšifruota forma.",
            "Jūsų įmonės duomenys: viskas, ką įvedate ar įkeliate savo darbo vietoje — įmonės duomenys, klientai, sąskaitos ir pasiūlymai, atsargos, suskaitmeninti dokumentai, pastabos ir pokalbiai su DI.",
            "Techniniai duomenys: prisijungimo raktas jūsų naršyklėje, kad liktumėte prisijungę, ir jūsų kalbos pasirinkimas. Nenaudojame reklaminių ar sekimo slapukų.",
          ],
        },
        {
          heading: "Kodėl saugome",
          body: [
            "Kad galėtume teikti jums LegacyLift pagal mūsų susitarimą (BDAR 6 straipsnio 1 dalies b punktas), užtikrinti paslaugos saugumą ir užkirsti kelią piktnaudžiavimui (mūsų teisėtas interesas, f punktas) ir vykdyti teisines prievoles, pavyzdžiui, apskaitos reikalavimus (c punktas).",
            "Jūsų klientų duomenys darbo vietoje priklauso jums: jūs sprendžiate, kas saugoma ir kodėl, o mes juos tvarkome jūsų vardu tik tam, kad teiktume jums LegacyLift.",
          ],
        },
        {
          heading: "Kas gali matyti",
          body: [
            "Jūs ir žmonės, kuriems jūs ar jūsų LegacyLift konsultantas suteikiate prieigą prie jūsų įmonės. Mūsų komanda — kad sukurtų ir prižiūrėtų jūsų darbo vietą. Niekas kitas. Kiti klientai niekada nemato jūsų duomenų, o paskyrų sąrašą mato tik mūsų komanda. Mes neparduodame jūsų duomenų ir nenaudojame jų reklamai.",
          ],
        },
        {
          heading: "Paslaugos, kuriomis naudojamės",
          body: [
            "Supabase (duomenų bazė ir prisijungimas), jūsų duomenys saugomi Europos Sąjungoje (Frankfurte, Vokietijoje). GitHub Pages, kuri tik pateikia svetainės failus ir niekada negauna jūsų įmonės duomenų. Google arba Microsoft — tik jei pasirenkate prisijungti su jais. Anthropic (Claude), kai naudojate DI funkcijas: DI siunčiamas jūsų pateiktas tekstas ar failas ir atsakymui reikalingi įmonės duomenys; pagal Anthropic komercines sąlygas jie nenaudojami DI modeliams mokyti. El. pašto paslauga prisijungimo laiškams siųsti.",
          ],
        },
        {
          heading: "Kiek laiko saugome",
          body: [
            "Kol egzistuoja jūsų paskyra. Ištrynus paskyrą, ji pašalinama iš karto kartu su įmone, kurią sukūrėte patys ir su niekuo nesidalijate. Kopijos gali likti mūsų paslaugų teikėjo atsarginėse kopijose iki 30 dienų. Įrašus, kuriuos privalome saugoti pagal įstatymus, saugome tik tiek, kiek reikalauja įstatymai.",
          ],
        },
        {
          heading: "Jūsų teisės",
          body: [
            "Bet kada galite peržiūrėti ir taisyti savo duomenis LegacyLift, atsisiųsti juos visus (Nustatymai → Atsisiųsti atsarginę kopiją) ir ištrinti paskyrą (Nustatymai → Jūsų paskyra). Taip pat galite prašyti mūsų prieigos, ištaisymo, ištrynimo, apribojimo, kopijos perkėlimui arba nesutikti su tvarkymu: {contact}.",
            "Galite pateikti skundą duomenų apsaugos institucijai: Lietuvoje — Valstybinei duomenų apsaugos inspekcijai (vdai.lrv.lt), Latvijoje — Datu valsts inspekcija (dvi.gov.lv), Estijoje — Andmekaitse Inspektsioon (aki.ee).",
          ],
        },
        { heading: "Pakeitimai", body: ["Jei ši politika pasikeis jums svarbiu būdu, apie tai pranešime LegacyLift arba el. paštu prieš pakeitimui įsigaliojant."] },
      ],
    },
    terms: {
      title: "Naudojimo sąlygos",
      intro: "Šios sąlygos taikomos naudojantis LegacyLift, kurią teikia {operator}. Kurdami paskyrą su jomis sutinkate. Klausimai: {contact}.",
      sections: [
        { heading: "Paslauga", body: ["LegacyLift yra internetinė darbo vieta sąskaitoms, klientams, atsargoms, dokumentams ir DI pagalbai įmonėms su istorija. Laikui bėgant galime ją tobulinti ir keisti."] },
        { heading: "Jūsų paskyra", body: ["Pateikite teisingus duomenis ir saugokite prisijungimo duomenis. Jūs atsakote už tai, kas vyksta jūsų paskyroje, ir už žmones, kuriems suteikiate prieigą prie savo įmonės. Nedelsdami praneškite mums, jei manote, kad jūsų paskyra naudojasi kažkas kitas."] },
        { heading: "Jūsų duomenys", body: ["Jūsų įmonės duomenys lieka jūsų. Bet kada galite juos atsisiųsti ir perkelti kitur. Jūs atsakote už teisę įvesti savo klientų ir kontaktų asmens duomenis, o mes su jais elgiamės taip, kaip aprašyta privatumo politikoje."] },
        { heading: "Sąskaitos, mokesčiai ir DI", body: ["Jūs atsakote už savo išrašytas sąskaitas ir mokesčių, PVM bei apskaitos reikalavimų laikymąsi. DI rezultatai yra pasiūlymai: patikrinkite juos prieš išsaugodami, siųsdami ar jais remdamiesi. LegacyLift neteikia teisinių, mokesčių ar finansinių konsultacijų."] },
        { heading: "Prieinamumas", body: ["Stengiamės, kad LegacyLift veiktų, o jūsų duomenys būtų saugūs, tačiau negalime pažadėti, kad ji visada bus pasiekiama ar be klaidų. Laikykite svarbių duomenų atsargines kopijas (Nustatymai → Atsisiųsti atsarginę kopiją)."] },
        { heading: "Mokesčiai už paslaugą", body: ["Išbandyti LegacyLift galima nemokamai. Dėl mokamų paketų ir jų kainų su jumis susitariama atskirai prieš ką nors apmokestinant."] },
        { heading: "Naudojimo pabaiga", body: ["Bet kada galite nustoti naudotis ir ištrinti paskyrą nustatymuose. Galime sustabdyti paskyras, kuriomis piktnaudžiaujama arba kurios kelia pavojų paslaugai ar kitiems naudotojams, ir, kai įmanoma, paaiškinsime priežastį."] },
        { heading: "Atsakomybė ir teisė", body: ["Mūsų atsakomybė ribojama tiek, kiek leidžia įstatymai; niekas šiose sąlygose neriboja jūsų kaip vartotojo teisių. Taikoma teisė: {country}. Jei šios sąlygos pasikeis, apie tai pranešime prieš pakeitimui įsigaliojant."] },
      ],
    },
  },

  et: {
    updated: "Viimati uuendatud: {date}",
    operatorFallback: "LegacyLifti haldaja",
    contactFallback: "oma LegacyLifti nõustaja kaudu",
    back: "Tagasi LegacyLifti",
    privacy: {
      title: "Privaatsuspoliitika",
      intro: "See poliitika selgitab, millist teavet teie ja teie ettevõtte kohta LegacyLift hoiab, miks, kes seda näeb ja mida saate teha. LegacyLifti haldab {operator}. Küsimused ja taotlused: {contact}.",
      sections: [
        {
          heading: "Mida me hoiame",
          body: [
            "Teie konto: nimi, e-posti aadress, sisselogimisviis (e-post ja parool, Google või Microsoft), registreerumise ja viimase sisselogimise aeg ning kasutatav keel. Kui logite sisse Google'i või Microsoftiga, jagavad nad meiega ainult teie nime ja e-posti aadressi. Me ei näe ega hoia kunagi teie Google'i või Microsofti parooli; e-posti paroole hoiab meie andmebaasi teenusepakkuja ainult kaitstud, krüpteeritud kujul.",
            "Teie ettevõtte andmed: kõik, mida oma töölauale sisestate või üles laadite — ettevõtte andmed, kliendid, arved ja pakkumised, laovaru, digiteeritud dokumendid, märkmed ja vestlused tehisintellektiga.",
            "Tehnilised andmed: sisselogimisvõti teie brauseris, et püsiksite sisse logituna, ja teie keelevalik. Me ei kasuta reklaami- ega jälgimisküpsiseid.",
          ],
        },
        {
          heading: "Miks me seda hoiame",
          body: [
            "Et pakkuda teile LegacyLifti meie kokkuleppe alusel (isikuandmete kaitse üldmääruse artikli 6 lõike 1 punkt b), hoida teenus turvalisena ja vältida kuritarvitamist (meie õigustatud huvi, punkt f) ning täita õiguslikke kohustusi, näiteks raamatupidamisnõudeid (punkt c).",
            "Teie klientide andmed teie töölaual kuuluvad teile: teie otsustate, mida ja miks hoitakse, ning meie töötleme neid teie nimel ainult selleks, et pakkuda teile LegacyLifti.",
          ],
        },
        {
          heading: "Kes seda näeb",
          body: [
            "Teie ja inimesed, kellele teie või teie LegacyLifti nõustaja annab juurdepääsu teie ettevõttele. Meie meeskond — teie töölaua seadistamiseks ja toetamiseks. Mitte keegi teine. Teised kliendid ei näe kunagi teie andmeid ning kontode nimekirja näeb ainult meie meeskond. Me ei müü teie andmeid ega kasuta neid reklaamiks.",
          ],
        },
        {
          heading: "Teenused, mida kasutame",
          body: [
            "Supabase (andmebaas ja sisselogimine), teie andmeid hoitakse Euroopa Liidus (Frankfurdis, Saksamaal). GitHub Pages, mis edastab ainult veebilehe faile ega saa kunagi teie ettevõtte andmeid. Google või Microsoft — ainult siis, kui valite nendega sisselogimise. Anthropic (Claude), kui kasutate tehisintellekti funktsioone: tehisintellektile saadetakse teie antud tekst või fail ja vastuseks vajalikud ettevõtte andmed; Anthropicu ärilepingu tingimuste kohaselt ei kasutata neid tehisintellekti mudelite treenimiseks. E-posti teenus sisselogimiskirjade saatmiseks.",
          ],
        },
        {
          heading: "Kui kaua me seda hoiame",
          body: [
            "Seni, kuni teie konto on olemas. Konto kustutamisel eemaldatakse see kohe koos ettevõttega, mille te ise lõite ja mida te kellegagi ei jaga. Koopiad võivad meie teenusepakkuja varukoopiates säilida kuni 30 päeva. Seadusega nõutud kirjeid hoiame ainult nii kaua, kui seadus nõuab.",
          ],
        },
        {
          heading: "Teie õigused",
          body: [
            "Saate oma andmeid LegacyLiftis igal ajal vaadata ja parandada, need kõik alla laadida (Seaded → Laadi varukoopia alla) ja oma konto kustutada (Seaded → Teie konto). Võite meilt taotleda ka juurdepääsu, parandamist, kustutamist, piiramist, koopiat ülekandmiseks või esitada vastuväite töötlemisele: {contact}.",
            "Võite esitada kaebuse andmekaitseasutusele: Eestis Andmekaitse Inspektsioonile (aki.ee), Lätis Datu valsts inspekcija (dvi.gov.lv), Leedus Valstybinė duomenų apsaugos inspekcija (vdai.lrv.lt).",
          ],
        },
        { heading: "Muudatused", body: ["Kui see poliitika muutub teie jaoks olulisel viisil, teatame sellest LegacyLiftis või e-postiga enne muudatuse jõustumist."] },
      ],
    },
    terms: {
      title: "Kasutustingimused",
      intro: "Need tingimused kehtivad LegacyLifti kasutamisel, mida pakub {operator}. Konto loomisega nõustute nendega. Küsimused: {contact}.",
      sections: [
        { heading: "Teenus", body: ["LegacyLift on veebipõhine töölaud arvete, klientide, laovaru, dokumentide ja tehisintellekti abi jaoks pika ajalooga ettevõtetele. Võime seda aja jooksul täiustada ja muuta."] },
        { heading: "Teie konto", body: ["Esitage õiged andmed ja hoidke oma sisselogimisandmeid turvaliselt. Vastutate selle eest, mis teie kontol toimub, ja inimeste eest, kellele annate juurdepääsu oma ettevõttele. Andke meile kohe teada, kui arvate, et keegi teine kasutab teie kontot."] },
        { heading: "Teie andmed", body: ["Teie ettevõtte andmed jäävad teile. Saate need igal ajal alla laadida ja mujale viia. Vastutate selle eest, et teil on õigus sisestada oma klientide ja kontaktide isikuandmeid, ning meie käsitleme neid privaatsuspoliitikas kirjeldatud viisil."] },
        { heading: "Arved, maksud ja tehisintellekt", body: ["Vastutate enda väljastatud arvete ning maksu-, käibemaksu- ja raamatupidamisnõuete täitmise eest. Tehisintellekti tulemused on soovitused: kontrollige neid enne salvestamist, saatmist või neile tuginemist. LegacyLift ei anna õigus-, maksu- ega finantsnõu."] },
        { heading: "Kättesaadavus", body: ["Teeme kõik, et LegacyLift töötaks ja teie andmed oleksid turvalised, kuid ei saa lubada, et see on alati kättesaadav või vigadeta. Hoidke oluliste andmete varukoopiaid (Seaded → Laadi varukoopia alla)."] },
        { heading: "Tasud", body: ["LegacyLifti proovimine on tasuta. Tasulised paketid ja nende hinnad lepitakse teiega eraldi kokku enne, kui midagi tasustatakse."] },
        { heading: "Lõpetamine", body: ["Võite igal ajal lõpetada ja oma konto seadetes kustutada. Võime peatada kontod, mida kuritarvitatakse või mis ohustavad teenust või teisi kasutajaid, ning võimalusel selgitame põhjust."] },
        { heading: "Vastutus ja õigus", body: ["Meie vastutus on piiratud seadusega lubatud ulatuses; miski nendes tingimustes ei piira teie kui tarbija õigusi. Kohaldatav õigus: {country}. Kui need tingimused muutuvad, teatame sellest enne muudatuse jõustumist."] },
      ],
    },
  },
};
