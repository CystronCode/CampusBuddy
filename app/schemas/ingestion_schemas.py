from typing import List, Optional, Dict, Any, Type
from pydantic import BaseModel, Field

class TimetableSlot(BaseModel):
    day: int = Field(..., ge=1, le=7, description="Day of the week: 1=Monday, 7=Sunday")
    period: Optional[int] = Field(None, description="Class period number")
    start_time: str = Field(..., description="Start time in 24-hour HH:MM format")
    end_time: str = Field(..., description="End time in 24-hour HH:MM format")
    subject: str = Field(..., description="Subject code or title")
    kind: Optional[str] = Field("lecture", description="lecture, lab, tutorial, or other")
    short_code: Optional[str] = Field(None, description="Faculty short-code (e.g., AK, SM)")
    room: Optional[str] = Field(None, description="Room number or lab identifier")

class TimetableExtraction(BaseModel):
    slots: List[TimetableSlot] = Field(default_factory=list)

class MenuItem(BaseModel):
    day: Optional[int] = Field(None, ge=1, le=7, description="1=Monday..7=Sunday, or null if daily")
    meal: str = Field(..., description="breakfast, lunch, snacks, or dinner")
    item: str = Field(..., description="Item name")
    price: int = Field(..., ge=0, le=2000, description="Price in INR")
    is_veg: Optional[bool] = Field(None, description="True for veg, False for non-veg, null if unstated")

class MenuExtraction(BaseModel):
    items: List[MenuItem] = Field(default_factory=list)

class HolidayItem(BaseModel):
    date: str = Field(..., description="Holiday date in YYYY-MM-DD format")
    name: str = Field(..., description="Holiday name or occasion")
    kind: Optional[str] = Field(None, description="National, restricted, or vacation")

class HolidaysExtraction(BaseModel):
    holidays: List[HolidayItem] = Field(default_factory=list)

class FacultyMember(BaseModel):
    name: str = Field(..., description="Full faculty member name")
    short_code: Optional[str] = Field(None, description="Faculty abbreviation (e.g. AS, RKM)")
    department: Optional[str] = Field(None, description="Department code (e.g. CSE, ECE)")
    designation: Optional[str] = Field(None, description="Designation (e.g. Assistant Professor)")
    email: Optional[str] = Field(None, description="Official email address")
    cabin: Optional[str] = Field(None, description="Office/cabin room number")
    office_hours: Optional[str] = Field(None, description="Office hours availability")
    subjects: List[str] = Field(default_factory=list, description="Subjects taught")

class FacultyExtraction(BaseModel):
    faculty: List[FacultyMember] = Field(default_factory=list)

class PosterEvent(BaseModel):
    title: str = Field(..., description="Event title")
    club: Optional[str] = Field(None, description="Organizing club name")
    description: Optional[str] = Field(None, description="Brief summary or description of the event")
    venue: Optional[str] = Field(None, description="Event location or venue")
    starts_at: Optional[str] = Field(None, description="Start timestamp in ISO 8601 format")
    ends_at: Optional[str] = Field(None, description="End timestamp in ISO 8601 format")

GET_SCHEMA_FOR_TYPE: Dict[str, Type[BaseModel]] = {
    "timetable": TimetableExtraction,
    "menu": MenuExtraction,
    "holidays": HolidaysExtraction,
    "faculty": FacultyExtraction,
    "poster": PosterEvent,
}
