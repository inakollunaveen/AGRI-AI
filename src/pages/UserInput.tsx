import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sprout, MapPin, Ruler, Leaf, TestTube, Calendar, Droplets, Clock } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import useTranslate from "@/hooks/useTranslate";

const originalLabels = {
  title: "Farm Details",
  description: "Tell us about your farm to get personalized recommendations",
  location: "Location",
  locationPlaceholder: "Enter your farm location",
  landSize: "Land Size",
  landSizePlaceholder: "Enter land size (acres)",
  landType: "Land Type",
  landHealth: "Land Health (pH, fertility, etc.)",
  landHealthPlaceholder: "Describe soil condition",
  season: "Season",
  waterFacility: "Water Facility Availability",
  duration: "Farming Duration",
  saveButton: "Save Farm Details",
  savingButton: "Saving...",
  selectLocation: "Select location",
  selectLandType: "Select land type",
  selectSeason: "Select season",
  selectWaterFacility: "Select water facility availability",
  selectDuration: "Select farming duration",
  alluvial: "Alluvial Soil",
  red: "Red Soil",
  black: "Black Soil",
  sandy: "Sandy Soil",
  loamy: "Loamy Soil",
  kharif: "Kharif (Monsoon)",
  rabi: "Rabi (Winter)",
  zaid: "Zaid (Summer)",
  good: "Good",
  average: "Average",
  low: "Low",
  short: "Short term (1-3 months)",
  medium: "Medium term (3-6 months)",
  long: "Long term (6+ months)",
};

const UserInput = () => {
  const [formData, setFormData] = useState({
    location: "",
    landSize: "",
    landType: "",
    landHealth: "",
    season: "",
    waterFacility: "",
    duration: "",
    language: "en", // Default to English
  });
  const [loading, setLoading] = useState(false);
  const { saveUserInputData } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { translate, loading: translating } = useTranslate();

  const [translatedLabels, setTranslatedLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const translateLabels = async () => {
      const translated = await Promise.all(
        Object.entries(originalLabels).map(async ([key, value]) => ({
          [key]: await translate(value),
        }))
      );
      const newLabels = Object.assign({}, ...translated);
      setTranslatedLabels(newLabels);
    };
    translateLabels();
  }, [language, translate]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Save to backend database
      const response = await fetch('http://localhost:5001/api/user-inputs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'anonymous', // In a real app, this would be the logged-in user's ID
          ...formData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save farm details');
      }

      // Save to context for immediate use
      saveUserInputData(formData);
      toast.success("Farm details saved successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error('Error saving farm details:', error);
      toast.error("Failed to save details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formFields = [
    { key: "location", label: translatedLabels.location || "Location", icon: MapPin, placeholder: translatedLabels.locationPlaceholder || "Enter your farm location", type: "input" },
    { key: "landSize", label: translatedLabels.landSize || "Land Size", icon: Ruler, placeholder: translatedLabels.landSizePlaceholder || "Enter land size (acres)", type: "input" },
    {
      key: "landType",
      label: translatedLabels.landType || "Land Type",
      icon: Leaf,
      type: "select",
      options: [
        { value: "alluvial", label: translatedLabels.alluvial || "Alluvial Soil" },
        { value: "red", label: translatedLabels.red || "Red Soil" },
        { value: "black", label: translatedLabels.black || "Black Soil" },
        { value: "sandy", label: translatedLabels.sandy || "Sandy Soil" },
        { value: "loamy", label: translatedLabels.loamy || "Loamy Soil" }
      ]
    },
    { key: "landHealth", label: translatedLabels.landHealth || "Land Health (pH, fertility, etc.)", icon: TestTube, placeholder: translatedLabels.landHealthPlaceholder || "Describe soil condition", type: "input" },
    {
      key: "season",
      label: translatedLabels.season || "Season",
      icon: Calendar,
      type: "select",
      options: [
        { value: "kharif", label: translatedLabels.kharif || "Kharif (Monsoon)" },
        { value: "rabi", label: translatedLabels.rabi || "Rabi (Winter)" },
        { value: "zaid", label: translatedLabels.zaid || "Zaid (Summer)" }
      ]
    },
    {
      key: "waterFacility",
      label: translatedLabels.waterFacility || "Water Facility Availability",
      icon: Droplets,
      type: "select",
      options: [
        { value: "good", label: translatedLabels.good || "Good" },
        { value: "average", label: translatedLabels.average || "Average" },
        { value: "low", label: translatedLabels.low || "Low" }
      ]
    },
    {
      key: "duration",
      label: translatedLabels.duration || "Farming Duration",
      icon: Clock,
      type: "select",
      options: [
        { value: "short", label: translatedLabels.short || "Short term (1-3 months)" },
        { value: "medium", label: translatedLabels.medium || "Medium term (3-6 months)" },
        { value: "long", label: translatedLabels.long || "Long term (6+ months)" }
      ]
    },
    {
      key: "language",
      label: "Language",
      icon: null,
      type: "select",
      options: [
        { value: "en", label: "English" },
        { value: "hi", label: "हिंदी" },
        { value: "bn", label: "বাংলা" },
        { value: "te", label: "తెలుగు" },
        { value: "mr", label: "मराठी" },
        { value: "ta", label: "தமிழ்" },
        { value: "ur", label: "اردو" },
        { value: "gu", label: "ગુજરાતી" },
        { value: "kn", label: "ಕನ್ನಡ" },
        { value: "or", label: "ଓଡ଼ିଆ" },
        { value: "ml", label: "മലയാളം" },
        { value: "pa", label: "ਪੰਜਾਬੀ" },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <Card className="bg-card/80 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-primary/10 p-3 rounded-full">
                <Sprout className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-primary">{translatedLabels.title || "Farm Details"}</CardTitle>
            <CardDescription>{translatedLabels.description || "Tell us about your farm to get personalized recommendations"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {formFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key} className="flex items-center gap-2 text-sm font-medium">
                    {field.icon && <field.icon className="h-4 w-4 text-primary" />}
                    {field.label}
                  </Label>
                  {field.type === "input" ? (
                    <Input
                      id={field.key}
                      type="text"
                      placeholder={field.placeholder}
                      value={formData[field.key as keyof typeof formData]}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      required
                      className="bg-background/50"
                    />
                  ) : (
                    <Select onValueChange={(value) => handleInputChange(field.key, value)} required>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
              
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-primary-foreground mt-8"
                disabled={loading}
              >
                {loading ? (translatedLabels.savingButton || "Saving...") : (translatedLabels.saveButton || "Save Farm Details")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserInput;
