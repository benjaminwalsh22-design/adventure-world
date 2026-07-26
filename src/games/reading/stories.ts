/**
 * Reading Quest passages — tuned to a 5th-grade reading level (the spec's
 * stretch goal for 3rd–4th graders): longer sentences, richer vocabulary,
 * real facts kids love to repeat at dinner.
 *
 * Each story: ~120 words + 3 multiple-choice questions + its own bookmark.
 */

export interface StoryQuestion {
  q: string
  choices: [string, string, string]
  answer: 0 | 1 | 2
}

export interface Story {
  id: string
  title: string
  emoji: string
  topic: 'history' | 'nature' | 'geography'
  bookmarkKey: string
  bookmarkName: string
  paragraphs: string[]
  questions: StoryQuestion[]
}

export const STORIES: Story[] = [
  {
    id: 'colosseum',
    title: 'The Mighty Colosseum',
    emoji: '🏛️',
    topic: 'history',
    bookmarkKey: 'bookmarks/colosseum-gold',
    bookmarkName: 'Golden Colosseum',
    paragraphs: [
      'Nearly two thousand years ago, Roman engineers built the largest amphitheater the world had ever seen. The Colosseum could hold about fifty thousand spectators — as many people as a modern sports stadium!',
      'Its clever design included seventy-six numbered entrances, so enormous crowds could find their seats in minutes. On scorching summer days, sailors stretched a giant canvas awning called the velarium over the top, shading the audience like a huge umbrella.',
      'Perhaps most amazing of all, the arena floor could be flooded with water for pretend sea battles, with real ships! Beneath the floor hid a maze of tunnels and elevators that lifted scenery — and sometimes lions — up into the arena.',
    ],
    questions: [
      {
        q: 'About how many spectators could the Colosseum hold?',
        choices: ['Five hundred', 'Fifty thousand', 'Five million'],
        answer: 1,
      },
      {
        q: 'What was the velarium?',
        choices: ['A giant shade awning', 'A kind of gladiator sword', 'A Roman sailing ship'],
        answer: 0,
      },
      {
        q: 'What hid beneath the arena floor?',
        choices: ['A swimming pool', 'A treasure vault', 'Tunnels and elevators'],
        answer: 2,
      },
    ],
  },
  {
    id: 'aqueducts',
    title: 'Rivers in the Sky',
    emoji: '🌉',
    topic: 'history',
    bookmarkKey: 'bookmarks/aqueduct-blue',
    bookmarkName: 'Aqueduct Blue',
    paragraphs: [
      'How do you bring fresh water to a city of a million people — without pumps or electricity? The Romans solved this puzzle with aqueducts: stone channels that carried water for dozens of miles using nothing but gravity.',
      'Engineers tilted each channel ever so slightly downhill. The slope was so gentle that the water dropped only about the height of a footstep over an entire mile! When a valley blocked the path, they built soaring bridges with rows of graceful arches.',
      'Eleven aqueducts flowed into ancient Rome, filling fountains, public baths, and even homes. Some Roman aqueducts were built so well that they still carry water today.',
    ],
    questions: [
      {
        q: 'What force moved water through the aqueducts?',
        choices: ['Gravity', 'Electric pumps', 'Windmills'],
        answer: 0,
      },
      {
        q: 'What did engineers build when a valley blocked the path?',
        choices: ['Tunnels under the sea', 'Bridges with arches', 'Giant water slides'],
        answer: 1,
      },
      {
        q: 'How many aqueducts flowed into ancient Rome?',
        choices: ['Three', 'Eleven', 'One hundred'],
        answer: 1,
      },
    ],
  },
  {
    id: 'pompeii',
    title: 'The City Frozen in Time',
    emoji: '🌋',
    topic: 'history',
    bookmarkKey: 'bookmarks/vesuvius-red',
    bookmarkName: 'Vesuvius Flame',
    paragraphs: [
      'In the year 79, the mountain near the busy Roman town of Pompeii turned out to be a sleeping volcano — and it woke up. Mount Vesuvius erupted with tremendous force, hurling ash and stone high into the sky.',
      'Ash fell like gray snow for hours, burying the town several meters deep. Pompeii vanished from sight and was slowly forgotten for more than 1,500 years.',
      'When explorers finally uncovered it, they found a city frozen in time: loaves of bread still in ovens, paintings on walls, and streets with grooves worn by chariot wheels. Today scientists study Pompeii to learn exactly how ordinary Romans lived, shopped, and played.',
    ],
    questions: [
      {
        q: 'What buried the town of Pompeii?',
        choices: ['A flood from the sea', 'Ash from a volcano', 'A giant sandstorm'],
        answer: 1,
      },
      {
        q: 'About how long was Pompeii forgotten?',
        choices: ['More than 1,500 years', 'Ten years', 'One hundred days'],
        answer: 0,
      },
      {
        q: 'Why do scientists study Pompeii today?',
        choices: [
          'To find buried pirate gold',
          'To predict the weather',
          'To learn how ordinary Romans lived',
        ],
        answer: 2,
      },
    ],
  },
  {
    id: 'shewolf',
    title: 'The Legend of the She-Wolf',
    emoji: '🐺',
    topic: 'history',
    bookmarkKey: 'bookmarks/wolf-silver',
    bookmarkName: 'Silver She-Wolf',
    paragraphs: [
      'Every great city has a story about its beginning, and Rome’s is one of the wildest. Legend says twin baby brothers, Romulus and Remus, were left beside the flooding Tiber River — but instead of perishing, they were discovered by a mother wolf.',
      'The she-wolf cared for the twins in her cave on the Palatine Hill until a kind shepherd found them and raised them as his sons.',
      'When the brothers grew up, they decided to build a city of their own. They argued fiercely about which hill to build it on. Romulus won, and the city took his name: Rome. Romans loved this legend so much that statues of the she-wolf still stand in the city today.',
    ],
    questions: [
      {
        q: 'Who rescued the twins by the river?',
        choices: ['A mother wolf', 'A fisherman', 'A Roman soldier'],
        answer: 0,
      },
      {
        q: 'What did the brothers argue about?',
        choices: [
          'Who could run faster',
          'Which hill to build their city on',
          'What to name the river',
        ],
        answer: 1,
      },
      {
        q: 'Where does the name "Rome" come from?',
        choices: ['The word for wolf', 'The Tiber River', 'Romulus'],
        answer: 2,
      },
    ],
  },
  {
    id: 'romanroads',
    title: 'All Roads Lead to Rome',
    emoji: '🛤️',
    topic: 'geography',
    bookmarkKey: 'bookmarks/road-stone',
    bookmarkName: 'Stone Road',
    paragraphs: [
      'The Romans were history’s greatest road builders. Their empire was stitched together by more than 250,000 miles of roads — enough to circle the Earth ten times!',
      'Building a Roman road was like making a giant sandwich. Workers dug a deep trench, then layered large stones, gravel, and sand, and finally fitted flat paving stones on top. Roads were built slightly higher in the middle, so rainwater rolled off to the sides.',
      'These roads were so straight and so strong that messengers could gallop about fifty miles in a single day, and some Roman roads are still used two thousand years later. That is why people still say, "All roads lead to Rome."',
    ],
    questions: [
      {
        q: 'How were Roman roads like a sandwich?',
        choices: [
          'They were built in layers',
          'They were soft in the middle',
          'Workers ate lunch on them',
        ],
        answer: 0,
      },
      {
        q: 'Why were roads higher in the middle?',
        choices: ['To slow down carts', 'So rainwater rolled off', 'To hide treasure inside'],
        answer: 1,
      },
      {
        q: 'About how far could a messenger travel in one day?',
        choices: ['Five miles', 'Five hundred miles', 'Fifty miles'],
        answer: 2,
      },
    ],
  },
  {
    id: 'mediterranean',
    title: 'The Sea in the Middle of the World',
    emoji: '🌊',
    topic: 'nature',
    bookmarkKey: 'bookmarks/sea-teal',
    bookmarkName: 'Teal Wave',
    paragraphs: [
      'Rome grew rich beside the Mediterranean Sea, whose name means "the sea in the middle of the land." The Romans grew so powerful around it that they called it Mare Nostrum — "our sea."',
      'The Mediterranean touches three continents: Europe, Africa, and Asia. Its warm, salty water is home to dolphins, sea turtles, octopuses, and glowing jellyfish. Loggerhead turtles swim thousands of miles across it, returning to lay eggs on the very beaches where they hatched.',
      'Roman ships crossed this sea carrying olive oil, grain, and even wild animals for the Colosseum. Sailors steered without any maps of the ocean floor — they navigated by the stars, just like explorers of space would dream of doing centuries later.',
    ],
    questions: [
      {
        q: 'What does "Mediterranean" mean?',
        choices: [
          'The sea in the middle of the land',
          'The coldest sea on Earth',
          'The sea of many islands',
        ],
        answer: 0,
      },
      {
        q: 'How many continents touch the Mediterranean?',
        choices: ['One', 'Three', 'Six'],
        answer: 1,
      },
      {
        q: 'How did Roman sailors find their way?',
        choices: ['With computer maps', 'By following whales', 'By the stars'],
        answer: 2,
      },
    ],
  },
]
