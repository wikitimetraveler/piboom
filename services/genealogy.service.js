import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let genealogyData = null;

/**
 * Load genealogy data from laneData.json
 */
export function loadGenealogyData() {
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'laneData.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    genealogyData = JSON.parse(rawData);
    console.log(`✅ Genealogy data loaded: ${genealogyData.nodes.length} people, ${genealogyData.links.length} relationships`);
    return genealogyData;
  } catch (error) {
    console.error('❌ Error loading genealogy data:', error.message);
    return null;
  }
}

/**
 * Get all family data (nodes + links)
 */
export function getAllFamilyData() {
  if (!genealogyData) {
    loadGenealogyData();
  }
  return genealogyData;
}

/**
 * Get all family members (nodes only)
 */
export function getAllPeople() {
  if (!genealogyData) {
    loadGenealogyData();
  }
  return genealogyData?.nodes || [];
}

/**
 * Get person by ID
 */
export function getPersonById(id) {
  const people = getAllPeople();
  return people.find(person => person.id === parseInt(id));
}

/**
 * Search people by name
 */
export function searchPeople(query) {
  const people = getAllPeople();
  const lowerQuery = query.toLowerCase();
  return people.filter(person => 
    person.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get relationships for a person
 */
export function getRelationships(personId) {
  if (!genealogyData) {
    loadGenealogyData();
  }
  
  const id = parseInt(personId);
  const relationships = genealogyData.links.filter(link => 
    link.source === id || link.target === id
  );
  
  // Enrich with person data
  return relationships.map(rel => {
    const isSource = rel.source === id;
    const otherId = isSource ? rel.target : rel.source;
    const otherPerson = getPersonById(otherId);
    
    return {
      relation: rel.relation,
      person: otherPerson,
      direction: isSource ? 'from' : 'to'
    };
  });
}

/**
 * Get children of a person
 */
export function getChildren(personId) {
  const relationships = getRelationships(personId);
  return relationships.filter(rel => 
    rel.relation === 'father' || rel.relation === 'mother'
  ).map(rel => rel.person);
}

/**
 * Get parents of a person
 */
export function getParents(personId) {
  if (!genealogyData) {
    loadGenealogyData();
  }
  
  const id = parseInt(personId);
  const parentLinks = genealogyData.links.filter(link => 
    link.source === id && (link.relation === 'father' || link.relation === 'mother')
  );
  
  return parentLinks.map(link => ({
    relation: link.relation,
    person: getPersonById(link.target)
  }));
}

/**
 * Get spouse(s) of a person
 */
export function getSpouses(personId) {
  const relationships = getRelationships(personId);
  return relationships.filter(rel => rel.relation === 'spouse')
    .map(rel => rel.person);
}

/**
 * Get siblings of a person (share same parents)
 */
export function getSiblings(personId) {
  const parents = getParents(personId);
  if (parents.length === 0) return [];
  
  // Get all children of these parents
  const allChildren = new Set();
  parents.forEach(parent => {
    const children = getChildren(parent.person.id);
    children.forEach(child => {
      if (child.id !== parseInt(personId)) {
        allChildren.add(JSON.stringify(child));
      }
    });
  });
  
  return Array.from(allChildren).map(child => JSON.parse(child));
}

/**
 * Map birth year to musical era
 */
export function getMusicalEra(birthYear) {
  const year = parseInt(birthYear);
  
  if (year < 1600) return { era: 'Medieval', period: 'Medieval/Renaissance', music: 'Gregorian Chant, Early Polyphony' };
  if (year < 1750) return { era: 'Baroque', period: 'Baroque Era', music: 'Bach, Vivaldi, Handel' };
  if (year < 1820) return { era: 'Classical', period: 'Classical Era', music: 'Mozart, Haydn, Early Beethoven' };
  if (year < 1900) return { era: 'Romantic', period: 'Romantic Era', music: 'Beethoven, Chopin, Wagner' };
  if (year < 1920) return { era: 'Early Modern', period: 'Ragtime & Early Jazz', music: 'Scott Joplin, Early Blues' };
  if (year < 1940) return { era: 'Jazz Age', period: 'Jazz & Swing Era', music: 'Louis Armstrong, Duke Ellington' };
  if (year < 1955) return { era: 'Big Band', period: 'Swing & Big Band', music: 'Glenn Miller, Frank Sinatra' };
  if (year < 1965) return { era: 'Rock Birth', period: 'Birth of Rock & Roll', music: 'Elvis, Chuck Berry, Little Richard' };
  if (year < 1975) return { era: 'Classic Rock', period: 'Classic Rock & Psychedelic', music: 'Beatles, Stones, Pink Floyd, Led Zeppelin' };
  if (year < 1985) return { era: 'Disco/Punk', period: 'Disco, Punk & Arena Rock', music: 'Bee Gees, Sex Pistols, Queen' };
  if (year < 1995) return { era: 'Hip-Hop Rise', period: 'Hip-Hop, Hair Metal & Grunge', music: 'Run-DMC, Metallica, Nirvana' };
  if (year < 2005) return { era: 'Digital Age', period: 'Pop, Hip-Hop & Electronic', music: 'Eminem, Beyoncé, Daft Punk' };
  return { era: 'Streaming Era', period: 'Digital Streaming Era', music: 'All genres accessible' };
}

/**
 * Get people alive during a specific year
 */
export function getPeopleAliveDuring(year) {
  const people = getAllPeople();
  return people.filter(person => {
    const birthYear = parseInt(person.birthYear);
    const deathYear = person.deathYear ? parseInt(person.deathYear) : new Date().getFullYear();
    return birthYear <= year && deathYear >= year;
  });
}

/**
 * Get people by generation
 */
export function getPeopleByGeneration(generation) {
  const people = getAllPeople();
  return people.filter(person => person.generation === parseInt(generation));
}

/**
 * Get statistics about the family tree
 */
export function getFamilyStats() {
  if (!genealogyData) {
    loadGenealogyData();
  }
  
  const people = genealogyData.nodes;
  const links = genealogyData.links;
  
  // Count by generation
  const generationCounts = {};
  people.forEach(person => {
    generationCounts[person.generation] = (generationCounts[person.generation] || 0) + 1;
  });
  
  // Count by gender
  const genderCounts = { M: 0, F: 0 };
  people.forEach(person => {
    genderCounts[person.gender] = (genderCounts[person.gender] || 0) + 1;
  });
  
  // Year range
  const birthYears = people.map(p => parseInt(p.birthYear)).filter(y => !isNaN(y));
  const minYear = Math.min(...birthYears);
  const maxYear = Math.max(...birthYears);
  
  return {
    totalPeople: people.length,
    totalRelationships: links.length,
    generationCounts,
    genderCounts,
    yearRange: { min: minYear, max: maxYear },
    timespan: maxYear - minYear
  };
}

// Initialize on import
loadGenealogyData();

export default {
  loadGenealogyData,
  getAllFamilyData,
  getAllPeople,
  getPersonById,
  searchPeople,
  getRelationships,
  getChildren,
  getParents,
  getSpouses,
  getSiblings,
  getMusicalEra,
  getPeopleAliveDuring,
  getPeopleByGeneration,
  getFamilyStats
};

