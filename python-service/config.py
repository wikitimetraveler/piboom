"""
Configuration module for Python service.
Reads from .env file in parent directory to match Node.js config.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from parent directory (same as Node.js)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

class Config:
    """Configuration class for Python service."""
    
    # Server
    HOST = os.getenv('PYTHON_SERVICE_HOST', '127.0.0.1')
    PORT = int(os.getenv('PYTHON_SERVICE_PORT', '8000'))
    
    # Database - uses same DATABASE_URL as Node.js
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    if not DATABASE_URL:
        raise ValueError(
            'DATABASE_URL is required. Add it to your .env file:\n'
            'DATABASE_URL=postgresql://user:password@localhost:5432/dbname'
        )
    
    # API Keys (reuse from Node.js .env)
    NASA_API_KEY = os.getenv('NASA_API_KEY')
    DISASTER_REFRESH_TOKEN = os.getenv('DISASTER_REFRESH_TOKEN')
    MAPBOX_ACCESS_TOKEN = os.getenv('MAPBOX_ACCESS_TOKEN')
    
    # Disaster settings
    DISASTER_ROLLING_WINDOW_DAYS = int(os.getenv('DISASTER_ROLLING_WINDOW_DAYS', '90'))
    
    # Service settings
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    @classmethod
    def validate(cls):
        """Validate critical configuration."""
        errors = []
        
        if not cls.DATABASE_URL:
            errors.append('DATABASE_URL is not set')
        
        if errors:
            raise ValueError(f"Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors))
        
        return True

# Validate on import
Config.validate()
