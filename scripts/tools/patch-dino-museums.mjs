/**
 * One-shot merge of museum holdings into dinosaur-content.json.
 * Development work by David Lane
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const contentPath = path.join(process.cwd(), 'public/nature/data/dinosaur-content.json');

const museums = {
  coelophysis: [
    { name: 'Ruth Hall Museum of Paleontology', place: 'Ghost Ranch, Abiquiu, New Mexico', scale: 'small', kind: 'original', holds: 'On-site museum at the Whitaker Quarry, with Coelophysis bones from the Ghost Ranch mass-death assemblage.', url: 'https://www.ghostranch.org/museums/' },
    { name: 'New Mexico Museum of Natural History and Science', place: 'Albuquerque, New Mexico', scale: 'large', kind: 'original', holds: 'State museum blocks and mounts of Coelophysis bauri, the New Mexico state fossil, from Ghost Ranch.', url: 'https://www.nmnaturalhistory.org/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'Whitaker Quarry blocks excavated by the museum in 1947, including articulated Coelophysis skeletons.', url: 'https://www.amnh.org/explore/videos/shelf-life/ghost-ranch-fossil-site' },
    { name: 'Carnegie Museum of Natural History', place: 'Pittsburgh, Pennsylvania', scale: 'large', kind: 'original', holds: 'Ghost Ranch collection from the 1981 reopening of the Coelophysis quarry.', url: 'https://carnegiemnh.org/' },
    { name: 'Yale Peabody Museum', place: 'New Haven, Connecticut', scale: 'large', kind: 'original', holds: 'Historic research specimens of Coelophysis in the vertebrate paleontology collection.', url: 'https://peabody.yale.edu/' },
    { name: 'Museum of Northern Arizona', place: 'Flagstaff, Arizona', scale: 'small', kind: 'original', holds: 'Regional museum that joined the Ghost Ranch excavation and keeps Chinle Formation reptiles.', url: 'https://musnaz.org/' }
  ],
  plateosaurus: [
    { name: 'Sauriermuseum Frick', place: 'Frick, Switzerland', scale: 'small', kind: 'original', holds: 'Complete Plateosaurus skeleton in original find position from the town clay pit, plus the juvenile Fabian.', url: 'https://sauriermuseum-frick.ch/ausstellung/plateosaurus/' },
    { name: 'Staatliches Museum für Naturkunde Stuttgart', place: 'Stuttgart, Germany', scale: 'large', kind: 'original', holds: 'Major series of Plateosaurus skeletons from the Trossingen bonebed in Baden-Württemberg.', url: 'https://www.naturkundemuseum-bw.de/' },
    { name: 'Museum für Naturkunde', place: 'Berlin, Germany', scale: 'large', kind: 'original', holds: 'Mounted Plateosaurus and related Late Triassic sauropodomorph bones.', url: 'https://www.museumfuernaturkunde.berlin/en' },
    { name: 'Museum of the University of Tübingen', place: 'Tübingen, Germany', scale: 'small', kind: 'original', holds: 'University paleontological collection with historic Plateosaurus mounts from southern Germany.', url: 'https://www.unimuseum.uni-tuebingen.de/' },
    { name: 'Senckenberg Naturmuseum', place: 'Frankfurt, Germany', scale: 'large', kind: 'original', holds: 'Research and exhibit skeletons of Plateosaurus from central European Triassic quarries.', url: 'https://museumfrankfurt.senckenberg.de/' },
    { name: 'Natural History Museum', place: 'London, United Kingdom', scale: 'large', kind: 'cast', holds: 'Comparative casts and research material of Plateosaurus alongside other early dinosaurs.', url: 'https://www.nhm.ac.uk/' }
  ],
  herrerasaurus: [
    { name: 'Museo de Ciencias Naturales, Universidad Nacional de San Juan', place: 'San Juan, Argentina', scale: 'small', kind: 'original', holds: 'Holotype and referred bones of Herrerasaurus ischigualastensis from the Ischigualasto Formation.', url: 'https://www.unsj.edu.ar/' },
    { name: 'Parque Provincial Ischigualasto', place: 'Valle de la Luna, San Juan, Argentina', scale: 'small', kind: 'cast', holds: 'Site museum in the valley where Herrerasaurus was found, with interpretive mounts of the local fauna.', url: 'https://ischigualasto.gob.ar/' },
    { name: 'Museo Argentino de Ciencias Naturales Bernardino Rivadavia', place: 'Buenos Aires, Argentina', scale: 'large', kind: 'cast', holds: 'National collection with casts and research ties to the Ischigualasto early dinosaurs.', url: 'https://www.macnconicet.gob.ar/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'cast', holds: 'Research casts used to compare Herrerasaurus with other early theropods.', url: 'https://www.amnh.org/' },
    { name: 'Field Museum', place: 'Chicago, Illinois', scale: 'large', kind: 'cast', holds: 'Public and study casts of Herrerasaurus among early dinosaur mounts.', url: 'https://www.fieldmuseum.org/' }
  ],
  apatosaurus: [
    { name: 'Carnegie Museum of Natural History', place: 'Pittsburgh, Pennsylvania', scale: 'large', kind: 'original', holds: 'Nearly complete original skeleton CM 3018, Apatosaurus louisae, from Dinosaur National Monument.', url: 'https://carnegiemnh.org/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'Classic mount built around AMNH 460, a real Apatosaurus from the Morrison Formation.', url: 'https://www.amnh.org/' },
    { name: 'Yale Peabody Museum', place: 'New Haven, Connecticut', scale: 'large', kind: 'original', holds: 'Holotype of Apatosaurus ajax, YPM 1860, from the Marsh collection.', url: 'https://peabody.yale.edu/' },
    { name: 'Field Museum', place: 'Chicago, Illinois', scale: 'large', kind: 'original', holds: 'Mounted Apatosaurus in the Evolving Planet hall, with Morrison Formation bones.', url: 'https://www.fieldmuseum.org/' },
    { name: 'Dinosaur National Monument Quarry Exhibit Hall', place: 'Jensen, Utah', scale: 'small', kind: 'original', holds: 'In-place Apatosaurus and other sauropod bones still in the Carnegie Quarry cliff.', url: 'https://www.nps.gov/dino/' },
    { name: 'Wyoming Dinosaur Center', place: 'Thermopolis, Wyoming', scale: 'small', kind: 'original', holds: 'Working museum and quarry with Morrison sauropod bones, including apatosaurine material.', url: 'https://www.wyodino.org/' },
    { name: 'Brigham Young University Museum of Paleontology', place: 'Provo, Utah', scale: 'small', kind: 'original', holds: 'University museum holding Morrison Formation sauropod specimens from Utah.', url: 'https://geology.byu.edu/museum' }
  ],
  stegosaurus: [
    { name: 'National Museum of Natural History', place: 'Washington, D.C.', scale: 'large', kind: 'original', holds: 'The historic United States mount, USNM 4934, a real Stegosaurus stenops skeleton.', url: 'https://naturalhistory.si.edu/' },
    { name: 'Natural History Museum', place: 'London, United Kingdom', scale: 'large', kind: 'original', holds: 'Sophie, NHMUK PV R36730, the most complete Stegosaurus skeleton known.', url: 'https://www.nhm.ac.uk/' },
    { name: 'Carnegie Museum of Natural History', place: 'Pittsburgh, Pennsylvania', scale: 'large', kind: 'original', holds: 'Morrison Formation stegosaurs collected with the Carnegie Quarry dinosaurs.', url: 'https://carnegiemnh.org/' },
    { name: 'Denver Museum of Nature and Science', place: 'Denver, Colorado', scale: 'large', kind: 'original', holds: 'Colorado Morrison fossils, including Stegosaurus material from the Front Range.', url: 'https://www.dmns.org/' },
    { name: 'Yale Peabody Museum', place: 'New Haven, Connecticut', scale: 'large', kind: 'original', holds: 'Marsh type material of Stegosaurus from the western Jurassic.', url: 'https://peabody.yale.edu/' },
    { name: 'Dinosaur Journey', place: 'Fruita, Colorado', scale: 'small', kind: 'original', holds: 'Museums of Western Colorado house local Morrison Formation bones, including stegosaurs.', url: 'https://museumofwesternco.com/dinosaur-journey/' },
    { name: 'Wyoming Dinosaur Center', place: 'Thermopolis, Wyoming', scale: 'small', kind: 'original', holds: 'Smaller quarry museum with Jurassic armored-dinosaur bones from Wyoming.', url: 'https://www.wyodino.org/' }
  ],
  allosaurus: [
    { name: 'Natural History Museum of Utah', place: 'Salt Lake City, Utah', scale: 'large', kind: 'original', holds: 'Thousands of Allosaurus bones from the Cleveland-Lloyd Dinosaur Quarry.', url: 'https://nhmu.utah.edu/' },
    { name: 'Cleveland-Lloyd Dinosaur Quarry', place: 'near Price, Utah', scale: 'small', kind: 'original', holds: 'Bureau of Land Management site museum at the Allosaurus bone bed itself.', url: 'https://www.blm.gov/visit/cleveland-lloyd-dinosaur-quarry' },
    { name: 'National Museum of Natural History', place: 'Washington, D.C.', scale: 'large', kind: 'original', holds: 'USNM 4734, a well-known Allosaurus fragilis skeleton from the Morrison Formation.', url: 'https://naturalhistory.si.edu/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'Morrison Allosaurus mounts and study specimens in the fossil halls.', url: 'https://www.amnh.org/' },
    { name: 'Carnegie Museum of Natural History', place: 'Pittsburgh, Pennsylvania', scale: 'large', kind: 'original', holds: 'Allosaurus collected from the same western quarries as the museum sauropods.', url: 'https://carnegiemnh.org/' },
    { name: 'Denver Museum of Nature and Science', place: 'Denver, Colorado', scale: 'large', kind: 'original', holds: 'Front Range Jurassic predators, including Allosaurus, in the prehistoric halls.', url: 'https://www.dmns.org/' },
    { name: 'Museum of Ancient Life', place: 'Lehi, Utah', scale: 'large', kind: 'original', holds: 'Thanksgiving Point museum with Allosaurus mounts drawn from Utah Morrison quarries.', url: 'https://www.thanksgivingpoint.org/experience/museum-of-ancient-life/' },
    { name: 'Wyoming Dinosaur Center', place: 'Thermopolis, Wyoming', scale: 'small', kind: 'original', holds: 'Quarry museum with Allosaurus and other Morrison predators prepared on site.', url: 'https://www.wyodino.org/' }
  ],
  brachiosaurus: [
    { name: 'Field Museum', place: 'Chicago, Illinois', scale: 'large', kind: 'original', holds: 'Holotype of Brachiosaurus altithorax, FMNH P 25107, a real partial skeleton from Colorado.', url: 'https://www.fieldmuseum.org/' },
    { name: 'Museum für Naturkunde', place: 'Berlin, Germany', scale: 'large', kind: 'original', holds: 'The tall mounted skeleton long labeled Brachiosaurus brancai, now Giraffatitan brancai.', url: 'https://www.museumfuernaturkunde.berlin/en' },
    { name: 'Sauriermuseum Aathal', place: 'Aathal, Switzerland', scale: 'small', kind: 'cast', holds: 'Private museum mount of the tall brachiosaurid skeleton made famous in Berlin.', url: 'https://www.sauriermuseum.ch/' },
    { name: 'Dinosaur National Monument Quarry Exhibit Hall', place: 'Jensen, Utah', scale: 'small', kind: 'original', holds: 'Morrison Formation sauropod bones in the quarry wall, including brachiosaurid remains.', url: 'https://www.nps.gov/dino/' },
    { name: 'Natural History Museum of Utah', place: 'Salt Lake City, Utah', scale: 'large', kind: 'cast', holds: 'Jurassic giant displays that tell the Brachiosaurus and Giraffatitan story beside real Morrison fossils.', url: 'https://nhmu.utah.edu/' }
  ],
  diplodocus: [
    { name: 'Carnegie Museum of Natural History', place: 'Pittsburgh, Pennsylvania', scale: 'large', kind: 'original', holds: 'Dippy, the original Diplodocus carnegii skeleton CM 84, still the type specimen.', url: 'https://carnegiemnh.org/' },
    { name: 'Natural History Museum', place: 'London, United Kingdom', scale: 'large', kind: 'cast', holds: 'The first Carnegie Dippy cast, sent in 1905 and still a signature of the museum.', url: 'https://www.nhm.ac.uk/' },
    { name: 'Muséum national d\'Histoire naturelle', place: 'Paris, France', scale: 'large', kind: 'cast', holds: '1908 Carnegie cast of Diplodocus carnegii in the galleries of the Jardin des Plantes.', url: 'https://www.mnhn.fr/' },
    { name: 'Museum für Naturkunde', place: 'Berlin, Germany', scale: 'large', kind: 'cast', holds: 'Historic Carnegie cast of Diplodocus displayed with the museum Jurassic giants.', url: 'https://www.museumfuernaturkunde.berlin/en' },
    { name: 'Naturhistorisches Museum Wien', place: 'Vienna, Austria', scale: 'large', kind: 'cast', holds: '1909 Carnegie replica of Diplodocus carnegii in the imperial natural history museum.', url: 'https://www.nhm-wien.ac.at/' },
    { name: 'Museo Geologico Giovanni Capellini', place: 'Bologna, Italy', scale: 'small', kind: 'cast', holds: 'University museum that received a 1909 Dippy cast, a smaller hall with the full skeleton.', url: 'https://sma.unibo.it/' },
    { name: 'Museo de La Plata', place: 'La Plata, Argentina', scale: 'large', kind: 'cast', holds: '1912 Carnegie cast of Diplodocus, one of the southern replicas of the Pittsburgh original.', url: 'https://www.museo.fcnym.unlp.edu.ar/' },
    { name: 'Museo Nacional de Ciencias Naturales', place: 'Madrid, Spain', scale: 'large', kind: 'cast', holds: '1913 Carnegie cast of Diplodocus carnegii in the national natural science museum.', url: 'https://www.mncn.csic.es/' },
    { name: 'Dinosaur National Monument Quarry Exhibit Hall', place: 'Jensen, Utah', scale: 'small', kind: 'original', holds: 'Real diplodocid bones, including Diplodocus, still embedded in the quarry face.', url: 'https://www.nps.gov/dino/' },
    { name: 'Utah Field House of Natural History State Park Museum', place: 'Vernal, Utah', scale: 'small', kind: 'cast', holds: 'State park museum beside the monument, with Jurassic sauropod mounts for the local bone beds.', url: 'https://stateparks.utah.gov/parks/utah-field-house/' },
    { name: 'Wyoming Dinosaur Center', place: 'Thermopolis, Wyoming', scale: 'small', kind: 'original', holds: 'Quarry museum with diplodocid bones prepared from nearby Morrison Formation sites.', url: 'https://www.wyodino.org/' }
  ],
  tyrannosaurus: [
    { name: 'Field Museum', place: 'Chicago, Illinois', scale: 'large', kind: 'original', holds: 'Sue, FMNH PR 2081, the most complete Tyrannosaurus rex skeleton.', url: 'https://www.fieldmuseum.org/' },
    { name: 'Museum of the Rockies', place: 'Bozeman, Montana', scale: 'large', kind: 'original', holds: 'One of the largest original T. rex collections, including growth-series specimens from Montana.', url: 'https://museumoftherockies.org/' },
    { name: 'National Museum of Natural History', place: 'Washington, D.C.', scale: 'large', kind: 'original', holds: 'The Nation\'s T. rex, a real skeleton from Montana now mounted in Washington.', url: 'https://naturalhistory.si.edu/' },
    { name: 'Carnegie Museum of Natural History', place: 'Pittsburgh, Pennsylvania', scale: 'large', kind: 'original', holds: 'Holotype CM 938, the partial skeleton on which Tyrannosaurus rex was named.', url: 'https://carnegiemnh.org/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'AMNH 5027, the skeleton behind the classic upright and modern mounts.', url: 'https://www.amnh.org/' },
    { name: 'Royal Tyrrell Museum', place: 'Drumheller, Alberta', scale: 'large', kind: 'original', holds: 'Black Beauty and other real tyrannosaur skeletons in a museum built in a small prairie town.', url: 'https://tyrrellmuseum.com/' },
    { name: 'Royal Saskatchewan Museum', place: 'Regina, Saskatchewan', scale: 'large', kind: 'original', holds: 'Scotty, RSM P2523.6, among the largest and most complete T. rex specimens.', url: 'https://royalsaskmuseum.ca/' },
    { name: 'Natural History Museum of Los Angeles County', place: 'Los Angeles, California', scale: 'large', kind: 'original', holds: 'Thomas, a real Tyrannosaurus mounted in the Dinosaur Hall.', url: 'https://nhmlac.org/' },
    { name: 'Burpee Museum of Natural History', place: 'Rockford, Illinois', scale: 'small', kind: 'original', holds: 'Jane, a juvenile Tyrannosaurus, in a city museum far smaller than the national halls.', url: 'https://www.burpee.org/' },
    { name: 'Carter County Museum', place: 'Ekalaka, Montana', scale: 'small', kind: 'original', holds: 'County museum with Hell Creek fossils from the Ekalaka area, including tyrannosaur bones.', url: 'https://www.cartercountymuseum.org/' }
  ],
  triceratops: [
    { name: 'National Museum of Natural History', place: 'Washington, D.C.', scale: 'large', kind: 'original', holds: 'Hatcher, USNM 4842, the classic real Triceratops horridus mount.', url: 'https://naturalhistory.si.edu/' },
    { name: 'Yale Peabody Museum', place: 'New Haven, Connecticut', scale: 'large', kind: 'original', holds: 'Marsh type material of Triceratops from the latest Cretaceous of the West.', url: 'https://peabody.yale.edu/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'Several real Triceratops skulls and skeletons in the fossil halls.', url: 'https://www.amnh.org/' },
    { name: 'Museum of the Rockies', place: 'Bozeman, Montana', scale: 'large', kind: 'original', holds: 'A growth series of original Triceratops skulls from the Hell Creek Formation.', url: 'https://museumoftherockies.org/' },
    { name: 'Royal Tyrrell Museum', place: 'Drumheller, Alberta', scale: 'large', kind: 'original', holds: 'Horned-dinosaur skeletons, including Triceratops, from the latest Cretaceous.', url: 'https://tyrrellmuseum.com/' },
    { name: 'Field Museum', place: 'Chicago, Illinois', scale: 'large', kind: 'original', holds: 'Triceratops mounts and skulls shown with Sue in the Cretaceous halls.', url: 'https://www.fieldmuseum.org/' },
    { name: 'Burpee Museum of Natural History', place: 'Rockford, Illinois', scale: 'small', kind: 'original', holds: 'Homer, a real Triceratops, in the same smaller city museum as Jane the tyrannosaur.', url: 'https://www.burpee.org/' },
    { name: 'Milwaukee Public Museum', place: 'Milwaukee, Wisconsin', scale: 'large', kind: 'original', holds: 'Historic dinosaur hall with a Triceratops mount among North American Cretaceous fossils.', url: 'https://www.mpm.edu/' },
    { name: 'Science Museum of Minnesota', place: 'Saint Paul, Minnesota', scale: 'large', kind: 'cast', holds: 'Public Triceratops mount used to teach the Hell Creek fauna beside real fossil collections.', url: 'https://www.smm.org/' },
    { name: 'Carter County Museum', place: 'Ekalaka, Montana', scale: 'small', kind: 'original', holds: 'Small county museum with a local Triceratops and other Hell Creek bones.', url: 'https://www.cartercountymuseum.org/' }
  ],
  parasaurolophus: [
    { name: 'Royal Ontario Museum', place: 'Toronto, Ontario', scale: 'large', kind: 'original', holds: 'Holotype of Parasaurolophus walkeri, ROM 768, including the famous crest.', url: 'https://www.rom.on.ca/' },
    { name: 'Natural History Museum of Utah', place: 'Salt Lake City, Utah', scale: 'large', kind: 'original', holds: 'Exceptional Parasaurolophus skulls from southern Utah\'s Kaiparowits Formation.', url: 'https://nhmu.utah.edu/' },
    { name: 'New Mexico Museum of Natural History and Science', place: 'Albuquerque, New Mexico', scale: 'large', kind: 'original', holds: 'New Mexico crested hadrosaurs, including Parasaurolophus tubicen and P. cyrtocristatus.', url: 'https://www.nmnaturalhistory.org/' },
    { name: 'Royal Tyrrell Museum', place: 'Drumheller, Alberta', scale: 'large', kind: 'original', holds: 'Alberta hadrosaur skeletons and crests from Dinosaur Provincial Park.', url: 'https://tyrrellmuseum.com/' },
    { name: 'Dinosaur Provincial Park Visitor Centre', place: 'Patricia, Alberta', scale: 'small', kind: 'original', holds: 'Field museum in the badlands where hadrosaur bone beds, including crested forms, were quarried.', url: 'https://www.albertaparks.ca/parks/south/dinosaur-pp/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'cast', holds: 'Crested-hadrosaur mounts and casts used beside the original research collections.', url: 'https://www.amnh.org/' }
  ],
  velociraptor: [
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'Holotype skull of Velociraptor mongoliensis, AMNH FR 6515, from the Flaming Cliffs.', url: 'https://www.amnh.org/' },
    { name: 'Institute of Paleobiology, Polish Academy of Sciences', place: 'Warsaw, Poland', scale: 'small', kind: 'original', holds: 'ZPAL specimens of Velociraptor from the Polish–Mongolian expeditions, in a research museum.', url: 'https://www.paleo.pan.pl/' },
    { name: 'Central Museum of Mongolian Dinosaurs', place: 'Ulaanbaatar, Mongolia', scale: 'small', kind: 'original', holds: 'Home of original Gobi specimens, including the fighting Velociraptor and Protoceratops pair.', url: 'https://www.mongolialocalguide.com/ulaanbaatar/central-museum-of-mongolian-dinosaurs' },
    { name: 'Paleozoological Museum of China', place: 'Beijing, China', scale: 'large', kind: 'original', holds: 'IVPP museum with Velociraptor osmolskae and other feathered dromaeosaur bones.', url: 'https://www.paleozoo.cn/' },
    { name: 'Natural History Museum', place: 'London, United Kingdom', scale: 'large', kind: 'cast', holds: 'Public casts of Velociraptor shown with the evidence for feathers and the sickle claw.', url: 'https://www.nhm.ac.uk/' },
    { name: 'Wyoming Dinosaur Center', place: 'Thermopolis, Wyoming', scale: 'small', kind: 'cast', holds: 'Smaller quarry museum with a Velociraptor mount beside real Jurassic bones from the region.', url: 'https://www.wyodino.org/' }
  ],
  ankylosaurus: [
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'Holotype AMNH 5895 and the skull AMNH 5214, the original Ankylosaurus bones.', url: 'https://www.amnh.org/' },
    { name: 'National Museum of Natural History', place: 'Washington, D.C.', scale: 'large', kind: 'original', holds: 'Hell Creek armored-dinosaur specimens referred to Ankylosaurus and its kin.', url: 'https://naturalhistory.si.edu/' },
    { name: 'Museum of the Rockies', place: 'Bozeman, Montana', scale: 'large', kind: 'original', holds: 'Montana Hell Creek ankylosaurs, including armor and tail clubs.', url: 'https://museumoftherockies.org/' },
    { name: 'Royal Tyrrell Museum', place: 'Drumheller, Alberta', scale: 'large', kind: 'original', holds: 'A major ankylosaur hall of original Alberta armor, clubs, and skeletons.', url: 'https://tyrrellmuseum.com/' },
    { name: 'Burpee Museum of Natural History', place: 'Rockford, Illinois', scale: 'small', kind: 'cast', holds: 'City museum displays of armored dinosaurs alongside its real Hell Creek skeletons.', url: 'https://www.burpee.org/' },
    { name: 'Carter County Museum', place: 'Ekalaka, Montana', scale: 'small', kind: 'original', holds: 'Small county museum with armored-dinosaur bones from the local Hell Creek Formation.', url: 'https://www.cartercountymuseum.org/' }
  ],
  pteranodon: [
    { name: 'Yale Peabody Museum', place: 'New Haven, Connecticut', scale: 'large', kind: 'original', holds: 'Marsh type specimens of Pteranodon from the Niobrara Chalk of Kansas.', url: 'https://peabody.yale.edu/' },
    { name: 'Sternberg Museum of Natural History', place: 'Hays, Kansas', scale: 'small', kind: 'original', holds: 'University museum on the chalk beds, with original Niobrara pterosaur skeletons.', url: 'https://sternberg.fhsu.edu/' },
    { name: 'University of Kansas Natural History Museum', place: 'Lawrence, Kansas', scale: 'small', kind: 'original', holds: 'Historic Kansas collection of Pteranodon bones from the Western Interior Seaway.', url: 'https://biodiversity.ku.edu/' },
    { name: 'American Museum of Natural History', place: 'New York, New York', scale: 'large', kind: 'original', holds: 'Niobrara Pteranodon specimens in the vertebrate paleontology collection and halls.', url: 'https://www.amnh.org/' },
    { name: 'National Museum of Natural History', place: 'Washington, D.C.', scale: 'large', kind: 'original', holds: 'Smithsonian Pteranodon mounts and original chalk fossils.', url: 'https://naturalhistory.si.edu/' },
    { name: 'University of Nebraska State Museum', place: 'Lincoln, Nebraska', scale: 'small', kind: 'original', holds: 'University museum with Western Interior Seaway reptiles, including pterosaur bones.', url: 'https://museum.unl.edu/' }
  ],
  mosasaurus: [
    { name: 'Muséum national d\'Histoire naturelle', place: 'Paris, France', scale: 'large', kind: 'original', holds: 'The original Maastricht skull of Mosasaurus hoffmannii, taken to Paris in 1794.', url: 'https://www.mnhn.fr/' },
    { name: 'Natuurhistorisch Museum Maastricht', place: 'Maastricht, Netherlands', scale: 'small', kind: 'original', holds: 'City museum at the discovery quarries, with local mosasaur bones including Prognathodon Bèr.', url: 'https://www.nhmmaastricht.nl/' },
    { name: 'Teylers Museum', place: 'Haarlem, Netherlands', scale: 'small', kind: 'original', holds: 'Eighteenth-century cabinet with Maastricht reptile fossils from the same chalk as Mosasaurus.', url: 'https://www.teylersmuseum.nl/' },
    { name: 'Royal Belgian Institute of Natural Sciences', place: 'Brussels, Belgium', scale: 'large', kind: 'original', holds: 'One of the great mosasaur galleries, with original North Sea Basin skeletons.', url: 'https://www.naturalsciences.be/' },
    { name: 'Naturalis Biodiversity Center', place: 'Leiden, Netherlands', scale: 'large', kind: 'original', holds: 'National collection and mounts of Dutch mosasaurs, including research scans of Maastricht specimens.', url: 'https://www.naturalis.nl/' },
    { name: 'Natural History Museum', place: 'London, United Kingdom', scale: 'large', kind: 'original', holds: 'Historic Mosasaurus hoffmannii material in the marine-reptile collection.', url: 'https://www.nhm.ac.uk/' },
    { name: 'Yale Peabody Museum', place: 'New Haven, Connecticut', scale: 'large', kind: 'original', holds: 'North American mosasaur skeletons from the Cretaceous seaway, beside the European type story.', url: 'https://peabody.yale.edu/' }
  ]
};

const raw = await readFile(contentPath, 'utf8');
const content = JSON.parse(raw);
const ids = new Set(content.species.map((sp) => sp.id));
for (const id of Object.keys(museums)) {
  if (!ids.has(id)) throw new Error(`Unknown species ${id}`);
}
for (const sp of content.species) {
  if (!museums[sp.id]) throw new Error(`Missing museums for ${sp.id}`);
  sp.museums = museums[sp.id];
}
await writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`);
console.log(`Updated ${content.species.length} species`);
