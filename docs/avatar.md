Dostarczam, mistrzu chaosu i przyszły lord platform UGC 🔥

Zrobię teraz trzy rzeczy naraz, konkretnie, bez lania wody:

1. Zdefiniuję pierwszy model awatara v0 (twoja figurka akcji).
2. Rozpiszę sloty/customizację tak, żeby dało się to od razu wdrożyć technicznie.
3. Dam ci mini-plan wdrożenia w kodzie (runtime + edytor).

To będzie fundament. To jest rzecz, którą możesz jutro wrzucić do repo jako `avatar/`.

–––

1. Awatar v0 – sylwetka i kości
   –––

Twoja postać bazowa to humanoid ~1.8 jednostki wysokości (czyli np. 1.8m w świecie gry; skalę ustalamy na stałe dla kolizji). Proporcja lekko “heroic stylized”: barki trochę szerzej, nogi trochę dłużej, głowa lekko powiększona (około 1.2x rozmiaru realistycznego).

Żeby było wydajne i proste, nie używamy na start skinningu GPU (czyli żadnych wag wierzchołków, żadnego deformowania siatki). Zamiast tego ciało jest z kawałków (segmentów), a każdy kawałek jest po prostu childem danego jointa.

Drzewko kości v0:

Root
└─ Hips
├─ Spine
│   └─ Chest
│        └─ Neck
│             └─ Head
│
├─ Arm.L.Upper
│    └─ Arm.L.Lower
│         └─ Hand.L
│
├─ Arm.R.Upper
│    └─ Arm.R.Lower
│         └─ Hand.R
│
├─ Leg.L.Upper
│    └─ Leg.L.Lower
│         └─ Foot.L
│
└─ Leg.R.Upper
└─ Leg.R.Lower
└─ Foot.R

To jest ~16 node’ów transformu. Pięknie lekko. Każdy node ma `position`, `rotation` (quat) i ewentualnie uniform scale (skalę bym na MVP zamknął na 1.0 żeby nie psuć kolizji).

Animacja ruchu = zapis kluczy rotacji i pozycji dla tych node’ów w czasie. Każdy “segment ciała” to mesh przyczepiony do konkretnego node’a, np.:

* HeadMesh -> Head
* TorsoMesh -> Chest
* UpperArmLeftMesh -> Arm.L.Upper
* LowerArmLeftMesh -> Arm.L.Lower
* HandLeftMesh -> Hand.L
* UpperLegLeftMesh -> Leg.L.Upper
* LowerLegLeftMesh -> Leg.L.Lower
* FootLeftMesh -> Foot.L
  …i tak dalej lustrzanie dla prawej strony.

To jest dosłownie figurka akcji. Stawy zamiast mięśni.

Dlaczego to jest genialne na start:
– Jedna paczka animacji (bieganie, idle, skok, śmierć) działa u każdego gracza niezależnie od wyglądu.
– Masz kontrolę nad wysokością Hips → kamera third-person i hitbox będą stabilne zawsze.
– Łatwo debugować w WebGPU, bo każdy kawałek to jeden drawcall z własną macierzą modelu = brak magii skinningu w shaderze na MVP.
– To jest tanie dla ciebie psychicznie. Nie wkręcasz się od razu w problem “czemu łokieć wchodzi do łokcia przy skinningu czterema wagami na vertexie”.

Ten szkielet to twój standard. Gracz zawsze logicznie “ma” taki szkielet, nawet jeśli wizualnie wygląda jak smok czy robot. Twoje PvP i kolizje używają standardowej kapsuły wokół Hips→Head, nigdy surowej siatki.

Collider v0:

* Kapsuła o wysokości np. 1.8 i promieniu 0.4.
* Osadzona tak, żeby środek był w biodrach.
  To jest twój święty hitbox dla całego PvP, platformówek, czegokolwiek.

–––
2. Sloty kosmetyczne
–––

Żeby ludzie mogli czuć “to jestem ja”, nie robimy jednej zamkniętej skóry jak KoGaMa (“kup cały potwór i koniec”), tylko dzielimy ciało na sloty. To daje ci efekt Roblox (moduły), ale zachowujesz charakter KoGamy (możesz wyglądać nieludzko, bo możesz zmienić całą rękę, nie tylko rękaw).

Definiuję sloty v0:

Core body slots:

* HeadSlot
* TorsoSlot (to obejmuje klatę/brzuch/barki jako jeden blok wizualny)
* UpperArmSlotL / UpperArmSlotR
* LowerArmSlotL / LowerArmSlotR
* HandSlotL / HandSlotR
* UpperLegSlotL / UpperLegSlotR
* LowerLegSlotL / LowerLegSlotR
* FootSlotL / FootSlotR

Cosmetic slots / prestige slots:

* FaceOverlaySlot (oczy/usta/maska/emocja – billboard/quad z teksturą, przyczepiany do Head)
* HairSlot (mesh włosów jako oddzielna bryła na Head)
* BackSlot (plecak, skrzydła, peleryna, zbiornik z toksycznym płynem)
* HeadFXSlot (korona, aureola, płomienie lewitujące nad głową)
* HandheldSlotR / HandheldSlotL (broń, miecz, narzędzie, pochodnia, sztandar gildii)

Każdy slot to po prostu mesh + materiał + ewentualnie dane koloru użytkownika.

Jak gracz “tworzy” avatar:
– Nie musi umieć robić rigów.
– Wybiera siatki slotów z listy (np. dla HeadSlot: “normalna głowa”, “głowa-kaptur assassina”, “głowa-slime przezroczysta z okiem w środku”).
– Wybiera paletę kolorów/akcentów (np. główny kolor, kolor detalu, kolor świecących linii).
– Dodaje FaceOverlay (czyli oczy / mimika).
– Dodaje HairSlot albo nie.
– Może dokleić BackSlot jak skrzydła.

To już tworzy bardzo różne sylwetki.

Ekonomia:
– Każdy slot jest sprzedawalny osobno.
– Możesz mieć darmowy bazowy set (żeby nowy gracz od razu wyglądał fajnie, nie jak bieda-kloc).
– Rare/back sloty to twój flex battle-pass / event drop / nagroda sezonowa.

To jest czysty system. Bardzo łatwy do skalowania. I to nie robi jeszcze skomplikowanych “layered clothing” jak w Roblox (gdzie kurtka leży na koszulce proceduralnie). Ty nie mapujesz odzieży na ciało. Ty po prostu podmieniasz cały segment siatki. To dużo prostsze technicznie niż layered clothing, ale efekt końcowy jest wciąż potężny wizualnie.

–––
3. Plan wdrożenia w kodzie (runtime + edytor)
–––

To jest jak możesz to zacząć implementować w twoim silniku TypeScript/WebGPU. Mówię to w języku architektury, jakbyśmy wchodzili do repo.

A. Definicje runtime:

`AvatarSkeleton`

* Zawiera drzewko jointów (Root/Hips/Spine/.../Foot.R).
* Każdy joint ma local transform i world transform.
* Ma metody `applyAnimationFrame(frameTime)` żeby ustawić rotacje/pozycje z kluczy animacji.

`AvatarSlotId`

* Enum/string literal union typu:
  "HeadSlot" | "TorsoSlot" | "UpperArmSlotL" | ... | "BackSlot" | "HandheldSlotR" | ...
  (wszystkie z sekcji wyżej)

`AvatarPart`

* Interfejs: `{ slot: AvatarSlotId; meshRef: MeshHandle; materialRef: MaterialHandle; colorOverrides?: { [channelName: string]: Vec3 }; }`
* `meshRef` mówi GPU runtime’owi, jaki mesh rysować.
* `materialRef` to shader params, tekstury itd.
* `colorOverrides` pozwala userowi zmieniać barwy bez robienia osobnej tekstury na każdy kolor.

`AvatarInstance`

* Ma `skeleton: AvatarSkeleton`
* Ma `parts: Map<AvatarSlotId, AvatarPart>`
* Ma `playAnimation("run")`, `playAnimation("idle")`, itd.
* Ma `getColliderCapsule()` (stała kapsuła na bazie pozycji Hips).

Render loop robi:

* dla każdego jointa w skeletonie → policz world matrix.
* dla każdego slotu w `parts` → weź world matrix jointa, przemnoż przez ewentualny offset części (np. rękawica może być przesunięta względem Hand.R), i wyślij jako modelMatrix przy drawcallu.

Czyli: żadnego skinningu. Po prostu instancing child-meshy na kościach.

B. Edytor awatara (creator UI dla gracza)

Potrzebujesz prostej sceny UI (może nawet w tym samym WebGPU rendererze, tylko z inną kamerą orbitującą wokół postaci) z menu po bokach:

– Lista slotów (Head, Torso, Arms, Legs, Back, Face, Hair, Weapon).
– Po kliknięciu slotu: karuzela wariantów meshów dostępnych dla tego slotu.
– Suwaki kolorów / pickery dla `colorOverrides`.
– Przy FaceOverlay: wybór oczu / ust / emotki – to może być po prostu atlas tekstur.

Naciskasz “Zapisz loadout” → serializujesz wybór do JSON-a:

```json
{
  "version": 1,
  "parts": {
    "HeadSlot": { "mesh": "head_slime_v2", "mat": "slime_glow", "colors": { "primary": [0,1,0] } },
    "TorsoSlot": { "mesh": "torso_mechA", "mat": "metal_dark", "colors": { "primary": [0.1,0.1,0.1], "emissive": [1,0,0] } },
    "BackSlot": { "mesh": "wings_bone_small", "mat": "bone_light" }
  }
}
```

I wtedy AvatarInstance potrafi się z tego JSON-a odbudować natychmiast po wejściu do gry.

To JSON = twój “skin savefile”, ale on też jest twoim handlem handlowo/rynkowym. Marketplace w przyszłości może sprzedawać paczki JSON (“full preset”), ale wewnętrznie to i tak jest zbiór części-slotów, więc nie łamie ci balansu jak KoGaMa. Czyli możesz mieć oba światy naraz:
– Ludzie sprzedają całe presety wyglądu (dla leniwych).
– Ludzie kupują pojedyncze części i miksują (dla kreatywnych).

C. Animacje

Animacje typu `run`, `jump`, `idle`, `emote_dance` możesz trzymać w ultraprostej formie:

* Każda animacja to timeline kluczy rotacji dla jointów skeletonu (`Arm.L.Upper`, `Leg.R.Upper`, itd.)
* Interpolacja slerp (spherical linear interpolation) dla quaternionów.
* Pozycja Root/Hips może mieć cykliczne przesunięcie w poziomie/lekko w pionie (bouncing przy biegu).
* To możesz generować ręcznie, albo importować z innego narzędzia i przepisać na klucze.

Zwróć uwagę, jak to się cudnie składa: masz jedną bibliotekę animacji i ona działa u wszystkich awatarów, bo każdy awatar ma ten sam skeleton logiczny. Nic nie pęka, nawet jak lewa ręka to cyber-ramię a prawa ręka to dłoń szkieleta w płomieniach.

D. Kamera i gameplay

Twoja kamera third-person powinna znać pozycję kości `Head` / `Chest` żeby ładnie kadrować postać z tyłu i trochę nad barkiem. Pierwszoosobowa kamera może się po prostu ustawić w `Head` i wyłączyć renderowanie HeadSlot (albo renderować osobny “viewmodel” rąk jak w FPS – to na później).

Kolizja gracza (bieganie, skakanie, wchodzenie na rampy) nie zależy od tego, jak wyglądają nogi. Ona używa stałej kapsuły. To daje ci czystą fizykę i czystą walkę w PvP. Nie będzie pay-to-win przez małe modele.

–––
4. Dlaczego to się dobrze skleja z twoją wizją platformy UGC
–––

Ty chcesz platformę, nie tylko jedną grę. To znaczy:
– jeden runtime klienta (render, kamera, input, avatar),
– wiele różnych światów/gier trybowych.

Jeżeli wszystkie gry dzielą tego samego awatara (czyli niesiesz swoją tożsamość między światami), to nagle:
– nie musisz sprzedawać ubrań per gra,
– nie musisz robić miliona creatorów postaci,
– twoja ekonomia zaczyna być globalna (jedna waluta = jeden marketplace = viral efekt sieciowy).

To jest dokładnie powód, dla którego Roblox jest Robloxem, a nie “kolekcją minigierek bez wspólnego konta”. Awatar + ekwipunek + znajomi przenoszą się między grami. To jest klej społeczny. Ludzie wracają dla ludzi.

–––
Wersja totalnie praktyczna: co dodajesz do repo TERAZ
–––

1. `engine/avatar/skeleton.ts`

   * definicja jointów, hierarchia, transform local/world, update

2. `engine/avatar/animation.ts`

   * prosta struktura klatek animacji dla tych jointów
   * player, który umie odtwarzać bieganie/idle/skok

3. `engine/avatar/slots.ts`

   * enum slotów
   * interfejs AvatarPart

4. `engine/avatar/avatar-instance.ts`

   * { skeleton, parts } + metoda renderowania
   * metoda serialize()/deserialize() loadoutu

5. `editor/avatar-customizer/`

   * mała scena orbit-kamery
   * UI do wyboru meshy per slot i zmian kolorów
   * zapisuje JSON loadoutu, który runtime potrafi wczytać

To jest MVP twojego awatara. To jest też MVP tożsamości twojej platformy.

I teraz ważne: to już jest “feature do pokazania inwestorowi / studiu / YouTube”. Kiedy ludzie zobaczą własną postać, która już biega w twojej scenie WebGPU i można jej zmieniać rękę na cyber-rękę w locie, to przestaje być “silnik hobbysty” i zaczyna być “o kurde on buduje metaplatformę”.

To jest moment, gdzie zaczyna się magia społeczna.
