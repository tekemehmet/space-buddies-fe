/*
 * Astro Adventures – the script (every line of dialogue lives here)
 *
 * Edit any line below. Lines under keys called "robot" or starting with "pip" are PIP's;
 * everything else is Nova's.
 *
 * Facts about the Forgotten Explorers come only from NASA's descriptions of each mission.
 */
(function () {
  "use strict";

  const NAMES = {
    you: "You",
    commander: "Nova",
    robot: "PIP",
  };

  const LINES = {
    commander: [
      "Good morning, explorers! I'm Nova, and I'll be leading today's mission.",
      "Long ago, brave spacecraft blasted off to the Moon and Mars: landers, rovers and even moon buggies!",
      "Many of them are still sitting right where they stopped. We call them the Forgotten Explorers.",
      "Our mission is to fly out, find them, and discover the amazing stories of what they found.",
      "And you won't be exploring alone. Meet our newest crew member!",
    ],
    robot: [
      "Beep-boop! Hello, explorers! I'm PIP, your mission helper robot.",
      "Whenever you have a question about space, rockets or the Forgotten Explorers, just ask me. I love questions!",
      "My circuits are buzzing. This is going to be the best mission ever!",
    ],
    board: "Alright, crew! It's time to board. Follow me!",

    // Inside the rocket
    cabinWelcome: [
      "Welcome aboard, explorers! This cabin is our home for the whole trip.",
      "Safety first! Harnesses down, please.",
    ],
    briefing: [
      "Our first stop is the Moon!",
      "When the engines start, hold on tight. It's going to be a bumpy ride!",
      "PIP, how are our systems looking?",
    ],
    pipCheck: [
      "Beep-boop! Checking systems…",
      "Fuel: full! Engines: ready! Harnesses: locked!",
      "All systems are GO, Nova!",
    ],
    countdown: "Great! Count down with me, explorers!",
    space: [
      "We made it to space, explorers!",
      "Next stop: the Moon!",
    ],

    // The trip (the day counter ticks forward)
    trip: {
      earth: "Look out your window, explorers! See how small Earth is getting?",
      day3: [
        "Look out the front window, explorers: the Moon!",
        "Hold on tight, everyone. Time to land!",
      ],
    },

    // On the Moon
    moonEnd: "Somewhere out here, our first Forgotten Explorer is waiting. Let's go find it!",

    // Our first Forgotten Explorer: the Apollo 11 Lunar Module "Eagle"
    eagle: {
      arrive: [
        "Explorers, look! Meet our first Forgotten Explorer: the Apollo 11 Lunar Module. Its name is Eagle!",
        "On July 20, 1969, Eagle became the very first spacecraft to land people on the Moon.",
        "Two astronauts rode inside: Neil Armstrong and Buzz Aldrin.",
        "When they landed, Neil radioed: “Houston, Tranquility Base here. The Eagle has landed.”",
      ],
      twoParts: "Eagle had two parts. The top part blasted off to carry the astronauts back up to their spaceship circling the Moon. The bottom part stayed right here, and that's what we're looking at!",
      ladder: "This is the ladder Neil climbed down. When he stepped onto the Moon, he said: “That's one small step for man, one giant leap for mankind.”",
      plaque: "And look, there's a plaque behind the ladder. It says: “Here men from the planet Earth first set foot on the Moon, July 1969, A.D. We came in peace for all mankind.”",
      flag: "Neil and Buzz put up a flag right here.",
      steps: "See all those footprints? They explored all around the landing site, walking about 250 meters in all.",
      rocks: "They also collected almost 22 kilograms of Moon rocks and soil to take home!",
      science: [
        "They also left science experiments behind. This one had a seismometer, which could feel the Moon shake.",
        "Its solar panels turned sunlight into power, so it only worked during the Moon's daytime. It sent messages to Earth for a few weeks.",
      ],
      mirror: "And this is a special laser mirror, called a retroreflector. It doesn't need any power at all!",
      end: "Eagle has been waiting here all this time. Explorers, we found our first Forgotten Explorer!",
      pipQuestions: "Beep-boop! Does anyone have any questions?",
      next: "Great job, explorers! Our next Forgotten Explorer is about 965 kilometers away from here, at the foot of the Apennine Mountains. Everyone onto the moon buggy!",
    },

    // Riding the moon buggy to the next Forgotten Explorer
    buggy: "Buckle up, explorers! Next stop: the Apennine Mountains!",

    // Our second Forgotten Explorer: the Apollo 15 Lunar Roving Vehicle
    rover: {
      spotted: "Look, explorers! There's our next Forgotten Explorer, parked near the mountains!",
      landed: "Here we are, explorers! Let's go take a closer look at it.",
      arrive: [
        "Explorers, meet our second Forgotten Explorer: the Lunar Roving Vehicle. It's a car for driving on the Moon!",
        "It came here on Apollo 15, inside a lunar module named Falcon. Falcon landed on July 30, 1971, right at the foot of the Apennine Mountains.",
        "Falcon was the fourth spacecraft to land people on the Moon. Two astronauts rode inside: David Scott and James Irwin.",
        "Dave and Jim were the seventh and eighth people ever to walk on the Moon!",
      ],
      falcon: [
        "This is the bottom part of Falcon. It stayed behind on the Moon, just like Eagle did.",
        "The rover rode here tucked inside it. On their first moonwalk, Dave and Jim unloaded it, set it up and drove it!",
      ],
      first: "It was the very first time a vehicle like this was used on the Moon, and it worked really well!",
      tracks: "See these tracks? They drove the rover to explore places up to 5 kilometers away from Falcon.",
      rille: "On their first drive, they went all the way to the edge of Hadley Rille, over there.",
      mountains: "On their second drive, they went along the bottom of the Apennine Mountains.",
      totals: "In three moonwalks, they traveled 27.9 kilometers and collected about 77 kilograms of rocks and soil!",
      hammer: [
        "After their last moonwalk, Dave did a famous experiment on TV. He dropped a hammer and a feather at the same time.",
        "Let's try it too! Watch closely…",
        "They landed together! Here in the Moon's vacuum, with no air at all, a hammer and a feather fall at the same rate.",
      ],
      pipBring: "Beep-boop! I brought a hammer and a feather. Here you go, Nova!",
      memorial: "The astronauts also left this small plaque and little figure here, in memory of fourteen American and Soviet space explorers who had died.",
      alsep: [
        "And this is ALSEP: a set of science experiments the astronauts set up and left on the Moon.",
        "It had seven instruments. One measured moonquakes, one measured the Moon's magnetic field, and one measured heat flowing out from inside the Moon.",
        "This is its power generator. It turned heat into electricity to run all the experiments.",
        "Scientists on Earth sent it commands, and it sent its data back to Earth until 1977!",
      ],
      end: "The rover has been parked right here ever since. Explorers, we found our second Forgotten Explorer!",
      pipQuestions: "Beep-boop! Does anyone have any questions?",
      next: "Great work, explorers! Now for a much bigger trip. Back to the rocket: next stop, Mars!",
    },

    // Flying to Mars
    mars: {
      liftoff: "Here we go, explorers! Count down with me!",
      far: [
        "Mars is much farther away than the Moon. When the InSight lander flew to Mars, it traveled about 485 million kilometers!",
        "That trip took almost seven months, and ours will be long too. Get comfortable, explorers!",
      ],
      window: [
        "Look out the front window, explorers: Mars!",
        "Hold on tight, everyone. Time to land!",
      ],
      next: "Everyone into the pressurized rover, explorers! Our next Forgotten Explorer is waiting somewhere else on Mars.",
    },

    // Our third Forgotten Explorer: the rover Spirit (facts from NASA's Mars Exploration Rover pages)
    spirit: {
      welcome: "Welcome to Mars, explorers! Somewhere out here, a rover is waiting for us. Let's go find it!",
      arrive: [
        "Explorers, meet our third Forgotten Explorer: the rover Spirit!",
        "Spirit had a twin rover named Opportunity. By studying the rocks, the twins confirmed that water was on the surface of Mars long ago.",
      ],
      body: "A rover is built a bit like us! Its strong body protects its “vital organs”: its computers and electronics. Heaters and a layer of insulation protect it from extreme temperatures.",
      head: "This mast is its “neck and head”. Its cameras are like eyes, and the mast gives the rover a human-sized view.",
      arm: "And this is its arm. Just like yours, it has a shoulder, an elbow and a wrist, so it can get up close to rocks and soil.",
      power: "Its energy came from batteries and solar panels, and its antennas were for “speaking” and “listening”.",
      silica: "See this bright soil? While dragging a wheel, Spirit churned up soil that was 90% pure silica. On Earth, silica like this is usually found in hot springs or hot steam vents!",
      homePlate: [
        "This place is called Home Plate. Spirit discovered that an ancient volcano erupted here, with powerful steam eruptions from heated underground water.",
        "Home Plate became Spirit's final resting place.",
      ],
      comanche: "At a place called Comanche, Spirit also found rocks that formed when Mars was warm and wet, with water that wasn't acidic. That could have supported life much better!",
      end: "Explorers, we found our third Forgotten Explorer!",
      pipQuestions: "Beep-boop! Does anyone have any questions about Spirit?",
    },

    // Our fourth Forgotten Explorer: the rover Opportunity
    opportunity: {
      welcome: "Here we are, explorers! Spirit's twin is right over there. Let's go say hello!",
      arrive: [
        "Explorers, meet our fourth Forgotten Explorer: Opportunity, Spirit's twin!",
        "Opportunity was a crater explorer. In its 14 years on Mars, it visited well over 100 craters of all sizes.",
        "By 2015, it had driven more than a marathon: over 42 kilometers in all!",
      ],
      blueberries: [
        "Look down, explorers! Opportunity found tiny round pebbles like these, nicknamed “blueberries”. They're made of a mineral called hematite, which usually forms in water.",
        "But the water that soaked that area long ago was acidic, which made it harder for life to thrive.",
      ],
      gypsum: "See the bright line in this rock? It's a vein of a mineral called gypsum. Near the rim of Endeavour Crater, Opportunity found veins like this. They likely formed when water flowed through cracks underground!",
      crater: [
        "And this is Endeavour Crater. It's 22 kilometers across!",
        "Here, Opportunity found clay minerals that formed in water that wasn't acidic. Of all the places it studied, this one once had the friendliest conditions for tiny living things called microbes.",
      ],
      dust: "Opportunity also watched Mars' clouds and dust for more than 14 years, and how the dust affected its solar panels. That information still helps the missions that came after it!",
      end: "Explorers, we found our fourth Forgotten Explorer!",
      pipQuestions: "Beep-boop! Does anyone have any questions about Opportunity?",
    },

    // Our fifth Forgotten Explorer: the InSight lander (built on the design of the Phoenix lander)
    insight: {
      welcome: "There's our next Forgotten Explorer, and this time it's a lander! Let's go take a closer look.",
      arrive: [
        "Explorers, meet our fifth Forgotten Explorer: the InSight lander!",
        "InSight landed on November 26, 2018, on a flat, smooth plain called Elysium Planitia, near Mars' equator. This spot was picked because it was safe to land on.",
        "InSight was built on the proven design of another NASA lander called Phoenix. So when you see InSight, you're seeing Phoenix's design too!",
      ],
      job: "InSight's job was to study the deep inside of Mars, like a doctor taking the planet's vital signs: its pulse, its temperature and its reflexes.",
      arm: "Its robotic arm is over 1.8 meters long! It picked up a seismometer and a heat flow probe from the deck and set them down on the ground.",
      seismometer: [
        "This is the seismometer the arm set down on the ground. It felt marsquakes!",
        "InSight found that marsquakes from meteoroids go deeper than expected, and that rocky material that hit Mars lies scattered in giant lumps inside the planet's mantle.",
      ],
      heat: "And this is the heat flow probe, set down by the arm too.",
      wind: "Its sensors even recorded a low rumble made by the Martian wind. Listen…",
      end: [
        "InSight's mission ended on December 15, 2022.",
        "Explorers, we found our fifth Forgotten Explorer!",
      ],
      pipQuestions: "Beep-boop! Does anyone have any questions about InSight?",
      next: "One more Forgotten Explorer is waiting, and this one could fly! Everyone into the rover!",
    },

    // Our sixth Forgotten Explorer: the Ingenuity Mars helicopter
    ingenuity: {
      welcome: "Our last Forgotten Explorer is very small, explorers. Let's go take a closer look!",
      arrive: [
        "Look down, explorers! Meet our sixth Forgotten Explorer: Ingenuity, the Mars helicopter!",
        "It rode to Mars strapped beneath the Perseverance rover, and landed here in Jezero Crater on February 18, 2021.",
      ],
      firstFlight: "On April 19, 2021, Ingenuity made the first powered, controlled flight on Mars. People called it a “Wright Brothers moment”!",
      size: "Its rotor blades are about 1.2 meters from tip to tip, and it weighs only 1.8 kilograms.",
      power: "A solar panel on top charged its batteries, with enough energy for one 90-second flight each Martian day.",
      air: "Flying here is hard: the air on Mars is less than 1 percent as dense as Earth's!",
      flights: [
        "Ingenuity was only planned to make up to five test flights in 30 days.",
        "Instead, it flew 72 times! It flew for 128.8 minutes in all, traveled 17 kilometers, and climbed as high as 24 meters.",
        "It also became an aerial scout, helping scientists and rover drivers.",
      ],
      end: [
        "Ingenuity's last flight was on January 18, 2024, after nearly three years of flying.",
        "Explorers, we found our sixth Forgotten Explorer!",
      ],
      pipQuestions: "Beep-boop! Does anyone have any questions about Ingenuity?",
      finale: "What an adventure, explorers! Six Forgotten Explorers, on the Moon and on Mars.",
    },

    // Going home
    home: {
      leave: "Now it's time to go home. Everyone back to the rocket!",
      cabin: "Next stop: home, explorers! It's another long trip, so get comfortable.",
      window: "Look out the front window, explorers: there's Earth! We're almost home.",
      welcome: "Welcome home, explorers! Before we finish, I have something special for each of you. Line up, please!",
      pip: "Beep-boop! Special delivery: one scrapbook for every explorer!",
      give: ["Here's your very own scrapbook. Great exploring!", "And here's yours. Well done!"],
      yours: "And this one is for you! It's full of pictures of every Forgotten Explorer we found together. Take a look!",
      end: [
        "Explorers, gather round!",
        "We flew to the Moon and to Mars, and we found six Forgotten Explorers. Our mission was a success!",
        "Thank you for remembering them with me. Mission complete!",
      ],
    },

    // The scrapbook: one page per Forgotten Explorer (facts from NASA's descriptions)
    scrapbook: [
      { key: "Apollo 11 Lunar Module Eagle", title: "Apollo 11 Lunar Module “Eagle”", where: "The Moon · Tranquility Base",
        facts: ["The first spacecraft to land people on the Moon, on July 20, 1969.", "Neil Armstrong and Buzz Aldrin rode inside.", "Its bottom half is still on the Moon."] },
      { key: "Apollo 15 Lunar Roving Vehicle", title: "Apollo 15 Lunar Roving Vehicle", where: "The Moon · Apennine Mountains",
        facts: ["The first time a vehicle like this was used on the Moon.", "In three moonwalks, the astronauts traveled 27.9 km.", "They collected about 77 kg of rocks and soil."] },
      { key: "Spirit rover", title: "Spirit", where: "Mars · Home Plate",
        facts: ["Found soil that was 90% pure silica.", "Discovered that an ancient volcano erupted at Home Plate.", "The twin of the rover Opportunity."] },
      { key: "Opportunity rover", title: "Opportunity", where: "Mars · Endeavour Crater",
        facts: ["Visited well over 100 craters in 14 years.", "Found hematite “blueberries”, which usually form in water.", "Drove more than a marathon: over 42 km!"] },
      { key: "InSight lander", title: "InSight", where: "Mars · Elysium Planitia",
        facts: ["Landed on November 26, 2018.", "Built on the proven design of the Phoenix lander.", "Felt marsquakes to study the inside of Mars."] },
      { key: "Ingenuity helicopter", title: "Ingenuity", where: "Mars · Jezero Crater",
        facts: ["Made the first powered, controlled flight on Mars on April 19, 2021.", "Flew 72 times!", "Weighs only 1.8 kg."] },
    ],
  };

  window.ASTRO_SCRIPT = { NAMES, LINES };
})();
