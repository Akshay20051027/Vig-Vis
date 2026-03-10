"""Query normalizer for handling spelling mistakes and mixed-language queries.

This module corrects common misspellings and converts short/informal queries
into meaningful search queries for better FAISS retrieval accuracy.
"""

import re


class QueryNormalizer:
    """Normalize and correct user queries before FAISS search."""
    
    def __init__(self):
        # Common spelling corrections (misspelled → correct)
        self.spelling_corrections = {
            # Fees variations
            'pees': 'fees', 'fess': 'fees', 'fi': 'fees', 'fee': 'fees',
            
            # Hostel variations
            'hostal': 'hostel', 'hostle': 'hostel', 'hosel': 'hostel',
            'hostell': 'hostel', 'hostl': 'hostel',
            
            # Labs variations
            'lbas': 'labs', 'labz': 'labs', 'leb': 'labs', 'lab': 'labs',
            'laboratori': 'laboratory', 'laboratoris': 'laboratories',
            
            # Placement variations
            'palcement': 'placement', 'placements': 'placement',
            'placment': 'placement', 'plcement': 'placement',
            
            # Library variations
            'librari': 'library', 'librry': 'library', 'libary': 'library',
            'libraray': 'library', 'libry': 'library',
            
            # Infrastructure variations
            'infra': 'infrastructure', 'infrastracture': 'infrastructure',
            'infrastucture': 'infrastructure',
            
            # Transport variations
            'transprt': 'transport', 'transpt': 'transport',
            'trasport': 'transport', 'tranport': 'transport',
            
            # Admission variations
            'admision': 'admission', 'admissn': 'admission',
            'addmission': 'admission', 'admition': 'admission',
            
            # Course variations
            'corse': 'course', 'courses': 'course', 'cours': 'course',
            
            # General university terms
            'collage': 'college', 'colege': 'college', 'univrsity': 'university',
            'universty': 'university', 'unversity': 'university',
        }
        
        # Telugu/Hindi common words → English
        self.language_mappings = {
            # Telugu
            'unda': 'available', 'undi': 'available', 'untaya': 'available',
            'entha': 'how much', 'enti': 'what', 'ekkada': 'where',
            'ela': 'how', 'eppudu': 'when', 'evaru': 'who',
            'college': 'college', 'campus': 'campus',
            
            # Hindi
            'hai': 'is', 'kya': 'what', 'kitna': 'how much',
            'kaha': 'where', 'kab': 'when', 'kaise': 'how',
            'hain': 'are', 'ka': 'of', 'ke': 'of',
            
            # Mixed language connectors
            'lo': 'in', 'ki': 'to', 'ko': 'to',
            'ka': 'of', 'ke': 'of', 'ki': 'of',
        }
        
        # Intent patterns (keyword → full question)
        self.intent_patterns = {
            'fees': "What is the fee structure of the university?",
            'hostel': "Is hostel facility available in the university?",
            'labs': "What laboratories are available in the university?",
            'placement': "Tell me about placement opportunities in the university",
            'library': "Is there a library in the university?",
            'transport': "What transport facilities are available?",
            'admission': "What is the admission process?",
            'courses': "What courses are offered in the university?",
            'infrastructure': "Tell me about the infrastructure",
            'location': "Where is the university located?",
        }
    
    def light_normalize(self, query):
        """
        Light normalization: Only fix spelling and translate mixed-language words.
        Preserves the original query structure for better FAISS semantic matching.
        
        Args:
            query (str): Raw user input
            
        Returns:
            str: Lightly corrected query
        """
        if not query or not isinstance(query, str):
            return query
        
        # Convert to lowercase for processing
        normalized = query.lower().strip()
        
        # Remove extra punctuation but keep question marks
        normalized = re.sub(r'[^\w\s?]', ' ', normalized)
        
        # Step 1: Apply spelling corrections
        words = normalized.split()
        corrected_words = []
        for word in words:
            if word in self.spelling_corrections:
                corrected_words.append(self.spelling_corrections[word])
            else:
                corrected_words.append(word)
        
        normalized = ' '.join(corrected_words)
        
        # Step 2: Translate mixed language words (but keep structure)
        words = normalized.split()
        translated_words = []
        for word in words:
            if word in self.language_mappings:
                translated_words.append(self.language_mappings[word])
            else:
                translated_words.append(word)
        
        normalized = ' '.join(translated_words)
        
        # Step 3: Clean up extra spaces
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        return normalized
    
    def normalize(self, query):
        """
        Normalize and correct the user query.
        
        Args:
            query (str): Raw user input
            
        Returns:
            str: Corrected and normalized query
        """
        if not query or not isinstance(query, str):
            return query
        
        # Convert to lowercase for processing
        normalized = query.lower().strip()
        
        # Remove extra punctuation but keep question marks
        normalized = re.sub(r'[^\w\s?]', ' ', normalized)
        
        # Step 1: Apply spelling corrections
        words = normalized.split()
        corrected_words = []
        for word in words:
            # Check if word needs correction
            if word in self.spelling_corrections:
                corrected_words.append(self.spelling_corrections[word])
            else:
                corrected_words.append(word)
        
        normalized = ' '.join(corrected_words)
        
        # Step 2: Translate mixed language words
        words = normalized.split()
        translated_words = []
        for word in words:
            if word in self.language_mappings:
                translated_words.append(self.language_mappings[word])
            else:
                translated_words.append(word)
        
        normalized = ' '.join(translated_words)
        
        # Step 3: Clean up extra spaces
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        # Step 4: If query is very short (1-2 words), expand using intent
        words = normalized.split()
        if len(words) <= 2:
            # Check for known intents
            for intent_word, full_question in self.intent_patterns.items():
                if intent_word in normalized:
                    return full_question
        
        # Step 5: If query is still just a keyword with '?', expand it
        if normalized.endswith('?') and len(words) == 1:
            keyword = normalized.replace('?', '').strip()
            if keyword in self.intent_patterns:
                return self.intent_patterns[keyword]
        
        # Step 6: Convert common mixed-language patterns
        normalized = self._handle_common_patterns(normalized)
        
        return normalized
    
    def _handle_common_patterns(self, query):
        """Handle common mixed-language query patterns."""
        
        patterns = [
            # "fees entha" → "What is the fee structure?"
            (r'\b(fees?|pees)\s+(how much|entha)\b', 
             'What is the fee structure?'),
            
            # "hostel unda" → "Is hostel available?"
            (r'\b(hostel|hostal)\s+(available|unda|undi)\b',
             'Is hostel facility available in the university?'),
            
            # "labs enti" → "What labs are available?"
            (r'\b(labs?|lbas)\s+(what|enti|info|details?)\b',
             'What laboratories are available in the university?'),
            
            # "placement hai kya" → "How are placements?"
            (r'\b(placement|palcement)\s+(is|hai|kya|info)\b',
             'Tell me about placement opportunities in the university'),
            
            # "library unda" → "Is library available?"
            (r'\b(library|librari)\s+(available|unda|is|hai)\b',
             'Is there a library in the university?'),
            
            # "college lo labs" → "labs in college"
            (r'\bcollege\s+in\s+(\w+)\b', r'\1 in college'),
            
            # "fees how much" → "What is the fee structure?"
            (r'\b(fees?|pees)\s+how\s+much\b',
             'What is the fee structure?'),
            
            # "hostel facility" → expand
            (r'\bhostel\s+facility\b',
             'Is hostel facility available in the university?'),
            
            # "lab facilities" → expand
            (r'\blab\s+facilit(y|ies)\b',
             'What laboratories are available in the university?'),
        ]
        
        for pattern, replacement in patterns:
            query = re.sub(pattern, replacement, query, flags=re.IGNORECASE)
        
        return query
    
    def get_correction_info(self, original, normalized):
        """
        Get information about what corrections were made.
        
        Args:
            original (str): Original query
            normalized (str): Normalized query
            
        Returns:
            dict: Correction information
        """
        return {
            'original': original,
            'normalized': normalized,
            'was_corrected': original.lower().strip() != normalized.lower().strip()
        }


# Singleton instance
_normalizer = None

def get_normalizer():
    """Get or create the global QueryNormalizer instance."""
    global _normalizer
    if _normalizer is None:
        _normalizer = QueryNormalizer()
    return _normalizer


def normalize_query(query):
    """
    Convenience function to normalize a query.
    
    Args:
        query (str): Raw user input
        
    Returns:
        str: Normalized query
    """
    return get_normalizer().normalize(query)


def light_normalize_query(query):
    """
    Convenience function to lightly normalize a query (spelling only).
    
    Args:
        query (str): Raw user input
        
    Returns:
        str: Lightly normalized query
    """
    return get_normalizer().light_normalize(query)
