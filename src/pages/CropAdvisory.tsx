import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Sprout, DollarSign, Clock, TrendingUp, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const CropAdvisory = () => {
  const { t } = useTranslation();
  const { userInputData, selectCrop, selectedCrop } = useAuth();
  const { language } = useLanguage();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getSuitabilityColor = (suitability) => {
    switch (suitability) {
      case "Highly Suitable": return "text-green-600 bg-green-50 border-green-200";
      case "Very Suitable": return "text-blue-600 bg-blue-50 border-blue-200";
      case "Suitable": return "text-orange-600 bg-orange-50 border-orange-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!userInputData) {
        setError("Please provide your farm details first");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;
        const response = await fetch('http://localhost:5001/api/crop-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...userInputData, language: userInputData.language || language, apiKey }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch recommendations: ${errorText}`);
        }

        // Check if response is PDF
        const contentType = response.headers.get('content-type');
        if (contentType !== 'application/pdf') {
          throw new Error('Received unexpected response format. Expected PDF.');
        }

        // Handle PDF download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'farm_advisory_report.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        // Set a success message
        setRecommendations([{ cropName: 'Report Downloaded', reasoning: 'The farm advisory report has been downloaded as a PDF file in your selected language.' }]);
        toast.success('Report downloaded successfully!');
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError(err.message || 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [userInputData]);

  const handleSelectCrop = (cropName: string) => {
    selectCrop(cropName);
    toast.success(`Selected ${cropName} for farming plan`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToDashboard')}
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-primary">{t('cropAdvisory')}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-primary mb-4">
            {t('aiPoweredRecommendations')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('basedOnSoilClimate')}
          </p>
          {selectedCrop && (
            <div className="mt-4 p-4 bg-primary/10 rounded-lg inline-block">
              <p className="text-primary font-semibold">
                Selected Crop: {selectedCrop}
              </p>
            </div>
          )}
        </div>

        {loading && <p className="text-center text-primary">{t('loading')}</p>}
        {error && <p className="text-center text-red-600">{error}</p>}

        {/* Recommendations */}
        <div className="space-y-6">
          {recommendations.length === 0 && !loading && !error && (
            <p className="text-center text-muted-foreground">{t('noRecommendations')}</p>
          )}
          {recommendations.map((rec, index) => (
            <Card key={index} className="bg-card/80 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
                      <Sprout className="h-6 w-6" />
                      {rec.cropName}
                    </CardTitle>
                    <CardDescription className="text-lg mt-2">
                      {rec.reasoning}
                    </CardDescription>
                  </div>
                  <div className={`px-4 py-2 rounded-full border text-sm font-semibold ${getSuitabilityColor(rec.suitability || '')}`}>
                    {rec.suitability || t('suitabilityUnknown')}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Key Metrics */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-secondary/50 p-4 rounded-lg text-center">
                    <DollarSign className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-primary">{rec.requiredInvestment || t('investmentUnknown')}</div>
                    <div className="text-sm text-muted-foreground">{t('requiredInvestment')}</div>
                  </div>
                  <div className="bg-secondary/50 p-4 rounded-lg text-center">
                    <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-primary">{rec.expectedProfit || t('profitUnknown')}</div>
                    <div className="text-sm text-muted-foreground">{t('expectedProfit')}</div>
                  </div>
                  <div className="bg-secondary/50 p-4 rounded-lg text-center">
                    <CheckCircle className="h-6 w-6 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-primary">{t('high')}</div>
                    <div className="text-sm text-muted-foreground">{t('suitability')}</div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex gap-4">
                  <Button
                    onClick={() => handleSelectCrop(rec.cropName)}
                    className={`flex-1 ${selectedCrop === rec.cropName ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary-hover'} text-primary-foreground`}
                    disabled={selectedCrop === rec.cropName}
                  >
                    {selectedCrop === rec.cropName ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Selected
                      </>
                    ) : (
                      <>
                        <Sprout className="h-4 w-4 mr-2" />
                        {t('selectCrop')}
                      </>
                    )}
                  </Button>
                  {selectedCrop === rec.cropName && (
                    <Button asChild className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                      <Link to="/crop-plan">
                        Create Farming Plan
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default CropAdvisory;
