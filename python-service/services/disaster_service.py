"""
Disaster Service - Python implementation.
Handles disaster data retrieval and processing tasks.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import structlog

from database import execute_query, execute_one, execute_command
from config import Config

logger = structlog.get_logger()


class DisasterService:
    """Service for handling disaster-related operations."""
    
    @staticmethod
    async def get_recent_disasters(
        days: int = None,
        state_abbr: Optional[str] = None,
        event_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent disasters within rolling window.
        
        Args:
            days: Number of days to look back (default: from config)
            state_abbr: Filter by state abbreviation
            event_type: Filter by event type
            
        Returns:
            List of disaster records
        """
        days = days or Config.DISASTER_ROLLING_WINDOW_DAYS
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        query = """
            SELECT 
                id, source, event_type, county_fips, county_name, state_abbr,
                start_time, end_time, severity, title, lat, lng, source_id,
                raw, created_at
            FROM disasters
            WHERE start_time >= $1
        """
        params = [cutoff]
        param_count = 1
        
        if state_abbr:
            param_count += 1
            query += f" AND state_abbr = ${param_count}"
            params.append(state_abbr.upper())
        
        if event_type:
            param_count += 1
            query += f" AND event_type = ${param_count}"
            params.append(event_type)
        
        query += " ORDER BY start_time DESC"
        
        logger.info(
            "Fetching recent disasters",
            days=days,
            state=state_abbr,
            event_type=event_type
        )
        
        rows = await execute_query(query, *params)
        
        return [dict(row) for row in rows]
    
    @staticmethod
    async def get_disasters_by_county(
        county_fips: str,
        days: int = None
    ) -> List[Dict[str, Any]]:
        """
        Get disasters for a specific county.
        
        Args:
            county_fips: 5-digit FIPS code
            days: Number of days to look back
            
        Returns:
            List of disaster records for the county
        """
        days = days or Config.DISASTER_ROLLING_WINDOW_DAYS
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        query = """
            SELECT 
                id, source, event_type, county_fips, county_name, state_abbr,
                start_time, end_time, severity, title, lat, lng, source_id,
                raw, created_at
            FROM disasters
            WHERE county_fips = $1
              AND start_time >= $2
            ORDER BY start_time DESC
        """
        
        logger.info("Fetching county disasters", county_fips=county_fips, days=days)
        
        rows = await execute_query(query, county_fips, cutoff)
        
        return [dict(row) for row in rows]
    
    @staticmethod
    async def get_disasters_near_location(
        lat: float,
        lng: float,
        radius_miles: float = 50,
        days: int = None
    ) -> List[Dict[str, Any]]:
        """
        Get disasters near a location using PostGIS.
        
        Args:
            lat: Latitude
            lng: Longitude
            radius_miles: Search radius in miles
            days: Number of days to look back
            
        Returns:
            List of disasters with distance
        """
        days = days or Config.DISASTER_ROLLING_WINDOW_DAYS
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Convert miles to meters (PostGIS uses meters)
        radius_meters = radius_miles * 1609.34
        
        query = """
            SELECT 
                id, source, event_type, county_fips, county_name, state_abbr,
                start_time, end_time, severity, title, lat, lng, source_id,
                raw, created_at,
                ST_Distance(
                    ST_Transform(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 3857),
                    ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857)
                ) / 1609.34 as distance_miles
            FROM disasters
            WHERE start_time >= $3
              AND lat IS NOT NULL
              AND lng IS NOT NULL
              AND ST_DWithin(
                  ST_Transform(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 3857),
                  ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857),
                  $4
              )
            ORDER BY distance_miles ASC, start_time DESC
        """
        
        logger.info(
            "Fetching disasters near location",
            lat=lat,
            lng=lng,
            radius_miles=radius_miles,
            days=days
        )
        
        rows = await execute_query(query, lat, lng, cutoff, radius_meters)
        
        return [dict(row) for row in rows]
    
    @staticmethod
    async def get_disaster_stats(days: int = None) -> Dict[str, Any]:
        """
        Get aggregate disaster statistics.
        
        Args:
            days: Number of days to look back
            
        Returns:
            Dictionary with aggregate stats
        """
        days = days or Config.DISASTER_ROLLING_WINDOW_DAYS
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        query = """
            SELECT 
                COUNT(*) as total_disasters,
                COUNT(DISTINCT county_fips) as affected_counties,
                COUNT(DISTINCT state_abbr) as affected_states,
                COUNT(DISTINCT event_type) as event_types,
                json_agg(DISTINCT event_type) as event_type_list,
                json_agg(DISTINCT source) as sources
            FROM disasters
            WHERE start_time >= $1
        """
        
        logger.info("Fetching disaster stats", days=days)
        
        row = await execute_one(query, cutoff)
        
        return dict(row) if row else {}
    
    @staticmethod
    async def get_disasters_by_type(days: int = None) -> List[Dict[str, Any]]:
        """
        Get disaster count grouped by event type.
        
        Args:
            days: Number of days to look back
            
        Returns:
            List of event types with counts
        """
        days = days or Config.DISASTER_ROLLING_WINDOW_DAYS
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        query = """
            SELECT 
                event_type,
                COUNT(*) as count,
                COUNT(DISTINCT county_fips) as affected_counties,
                MIN(start_time) as earliest,
                MAX(start_time) as latest
            FROM disasters
            WHERE start_time >= $1
            GROUP BY event_type
            ORDER BY count DESC
        """
        
        logger.info("Fetching disasters by type", days=days)
        
        rows = await execute_query(query, cutoff)
        
        return [dict(row) for row in rows]
