"""
Text Processing Service.
Advanced text analysis, cleaning, and preprocessing.
"""
from typing import List, Dict, Any, Set
import re
import structlog

logger = structlog.get_logger()


class TextProcessingService:
    """Service for text processing operations."""
    
    # Common stop words for filtering
    STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these',
        'those', 'it', 'its', 'they', 'their', 'them', 'we', 'our', 'you',
        'your', 'he', 'she', 'him', 'her', 'his'
    }
    
    @staticmethod
    def clean_text(text: str) -> str:
        """
        Clean and normalize text.
        
        Args:
            text: Raw text
            
        Returns:
            Cleaned text
        """
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters but keep periods, commas, hyphens
        text = re.sub(r'[^\w\s.,\-]', '', text)
        
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        
        return text.strip()
    
    @staticmethod
    def extract_keywords(
        text: str,
        top_n: int = 10,
        min_length: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Extract keywords from text based on frequency.
        
        Args:
            text: Input text
            top_n: Number of top keywords to return
            min_length: Minimum keyword length
            
        Returns:
            List of keywords with frequencies
        """
        # Tokenize and clean
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filter stop words and short words
        filtered = [
            w for w in words
            if w not in TextProcessingService.STOP_WORDS and len(w) >= min_length
        ]
        
        # Count frequencies
        freq = {}
        for word in filtered:
            freq[word] = freq.get(word, 0) + 1
        
        # Sort by frequency
        keywords = [
            {"keyword": word, "frequency": count}
            for word, count in sorted(freq.items(), key=lambda x: x[1], reverse=True)
        ][:top_n]
        
        return keywords
    
    @staticmethod
    def extract_field_ids(text: str) -> List[str]:
        """
        Extract Encompass field IDs from text.
        
        Args:
            text: Text containing field IDs
            
        Returns:
            List of unique field IDs
        """
        field_ids = set()
        
        # Pattern for numeric field IDs (e.g., 4000, 1172)
        numeric_fields = re.findall(r'\b(?:Field[s]?\.)?(\d{3,4})\b', text)
        field_ids.update(numeric_fields)
        
        # Pattern for URLA fields (e.g., URLA.X75, URLA2020.X234)
        urla_fields = re.findall(r'\b(URLA(?:2020)?\.X?\d+)\b', text)
        field_ids.update(urla_fields)
        
        # Pattern for loan fields (e.g., Loan.LoanAmount)
        loan_fields = re.findall(r'\b(Loan\.\w+)\b', text)
        field_ids.update(loan_fields)
        
        return sorted(list(field_ids))
    
    @staticmethod
    def extract_api_endpoints(text: str) -> List[str]:
        """
        Extract API endpoints from text.
        
        Args:
            text: Text containing API endpoints
            
        Returns:
            List of unique endpoints
        """
        endpoints = set()
        
        # Pattern for REST endpoints
        patterns = [
            r'/encompass/v\d+/[^\s]+',
            r'/api/[^\s]+',
            r'https?://[^\s]+/encompass/[^\s]+'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            endpoints.update(matches)
        
        return sorted(list(endpoints))
    
    @staticmethod
    def calculate_readability_score(text: str) -> Dict[str, Any]:
        """
        Calculate basic readability metrics.
        
        Args:
            text: Input text
            
        Returns:
            Dictionary with readability metrics
        """
        # Split into sentences
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Split into words
        words = re.findall(r'\b\w+\b', text)
        
        # Count syllables (simple approximation)
        def count_syllables(word):
            word = word.lower()
            syllables = len(re.findall(r'[aeiouy]+', word))
            if word.endswith('e'):
                syllables -= 1
            return max(1, syllables)
        
        total_syllables = sum(count_syllables(w) for w in words)
        
        # Calculate metrics
        num_sentences = len(sentences)
        num_words = len(words)
        
        if num_sentences == 0 or num_words == 0:
            return {
                "sentences": 0,
                "words": 0,
                "avg_words_per_sentence": 0,
                "avg_syllables_per_word": 0
            }
        
        avg_words_per_sentence = num_words / num_sentences
        avg_syllables_per_word = total_syllables / num_words
        
        return {
            "sentences": num_sentences,
            "words": num_words,
            "syllables": total_syllables,
            "avg_words_per_sentence": round(avg_words_per_sentence, 2),
            "avg_syllables_per_word": round(avg_syllables_per_word, 2)
        }
    
    @staticmethod
    def summarize_text(text: str, max_sentences: int = 3) -> str:
        """
        Create a simple extractive summary.
        
        Args:
            text: Input text
            max_sentences: Maximum sentences in summary
            
        Returns:
            Summary text
        """
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if len(sentences) <= max_sentences:
            return text
        
        # Simple scoring: prefer sentences with more unique words
        def score_sentence(sentence):
            words = re.findall(r'\b\w+\b', sentence.lower())
            unique_words = set(
                w for w in words
                if w not in TextProcessingService.STOP_WORDS
            )
            return len(unique_words)
        
        # Score and rank sentences
        scored = [(score_sentence(s), i, s) for i, s in enumerate(sentences)]
        scored.sort(reverse=True)
        
        # Take top N sentences in original order
        selected = sorted(scored[:max_sentences], key=lambda x: x[1])
        summary = ' '.join(s[2] for s in selected)
        
        return summary
    
    @staticmethod
    def detect_language(text: str) -> str:
        """
        Detect text language (simple heuristic).
        
        Args:
            text: Input text
            
        Returns:
            Language code (en, es, etc.) or 'unknown'
        """
        # Very simple detection based on common words
        text_lower = text.lower()
        
        # English indicators
        en_words = ['the', 'and', 'is', 'to', 'in', 'of']
        en_count = sum(1 for w in en_words if f' {w} ' in f' {text_lower} ')
        
        # Spanish indicators
        es_words = ['el', 'la', 'de', 'que', 'y', 'es']
        es_count = sum(1 for w in es_words if f' {w} ' in f' {text_lower} ')
        
        if en_count > es_count:
            return 'en'
        elif es_count > 0:
            return 'es'
        
        return 'unknown'
    
    @staticmethod
    def batch_clean_texts(texts: List[str]) -> List[str]:
        """
        Clean multiple texts efficiently.
        
        Args:
            texts: List of texts to clean
            
        Returns:
            List of cleaned texts
        """
        return [TextProcessingService.clean_text(text) for text in texts]
