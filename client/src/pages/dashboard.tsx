import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Search, Menu, CloudSun, MessageCircle, Bot, X, HelpCircle, User, LogOut } from "lucide-react";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import InstallationAnalysis from "@/components/installation-analysis";
import FaultDetection from "@/components/fault-detection";
import AIChatWidget from "@/components/mobile-ai-chat-widget";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/navbar";
import ValidationCard from "@/components/validation-card";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'installation' | 'fault-detection'>('installation');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showValidationCard, setShowValidationCard] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [validationType, setValidationType] = useState<"success" | "error" | "warning">("warning");
  const { user, logoutMutation, healthStatus } = useAuth();

  // Check URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'fault-detection') {
      setActiveTab('fault-detection');
    } else if (tab === 'installation') {
      setActiveTab('installation');
    }
  }, []);

  // Show server unavailability message only for authenticated users who lose session
  useEffect(() => {
    // Only show server error if user was authenticated and server/database is down
    // Don't show for AI service issues (quota limits) - only for actual server/database problems
    if (healthStatus && user && (!healthStatus.server || !healthStatus.database) && healthStatus.message) {
      setValidationMessage(healthStatus.message);
      setValidationType("error");
      setShowValidationCard(true);
      setTimeout(() => {
        setShowValidationCard(false);
      }, 8000);
    }
  }, [healthStatus, user]);

  // Show logout success message after page reload
  useEffect(() => {
    const logoutSuccess = localStorage.getItem("logoutSuccess");
    if (logoutSuccess === "true") {
      localStorage.removeItem("logoutSuccess");
      setValidationMessage("You have logged out successfully.");
      setValidationType("success");
      setShowValidationCard(true);
      setTimeout(() => {
        setShowValidationCard(false);
      }, 3000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar 
        currentPage="dashboard" 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.history.pushState({}, '', `/?tab=${tab}`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Hero Section - Now visible on all devices */}
      <section className="bg-gradient-to-br from-primary to-blue-600 text-white pb-6 sm:pb-8 md:pb-10 lg:pb-12 xl:pb-16" style={{ paddingTop: '3.75rem' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="text-center flex flex-col justify-center items-center min-h-[150px] sm:min-h-[160px] md:min-h-[170px] lg:min-h-[180px] xl:min-h-[190px] pt-6 sm:pt-8 md:pt-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 sm:mb-4 md:mb-6 lg:mb-8">AI-Powered Solar Analysis</h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl opacity-90 px-2 max-w-4xl mx-auto">
              Plan installations and detect faults with advanced computer vision
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Tabs - Positioned below hero section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex border-b border-border">
            <button
              onClick={() => {
                setActiveTab('installation');
                window.history.pushState({}, '', '/?tab=installation');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 py-3 sm:py-4 px-3 sm:px-4 md:px-6 text-center font-medium transition-colors text-sm sm:text-base ${
                activeTab === 'installation'
                  ? 'text-primary border-b-2 border-primary bg-blue-50'
                  : 'text-secondary-custom hover:text-primary hover:bg-gray-50'
              }`}
            >
              <Home className="inline mr-1 sm:mr-2" size={16} />
              <span>Installation</span>
              <span className="hidden sm:inline"> Planning</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('fault-detection');
                window.history.pushState({}, '', '/?tab=fault-detection');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 py-3 sm:py-4 px-3 sm:px-4 md:px-6 text-center font-medium transition-colors text-sm sm:text-base ${
                activeTab === 'fault-detection'
                  ? 'text-primary border-b-2 border-primary bg-blue-50'
                  : 'text-secondary-custom hover:text-primary hover:bg-gray-50'
              }`}
            >
              <Search className="inline mr-1 sm:mr-2" size={16} />
              <span>Fault</span>
              <span className="hidden sm:inline"> Detection</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Application Interface */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Content Sections */}
        {activeTab === 'installation' && <InstallationAnalysis />}
        {activeTab === 'fault-detection' && <FaultDetection />}
      </main>

      {/* AI Chat Widget */}
      <AIChatWidget />
      
      {/* Validation Card for Server Issues and Logout - Responsive positioning below navbar */}
      {showValidationCard && (
        <div className="fixed top-20 sm:top-24 md:top-28 right-2 sm:right-4 md:right-6 z-[10000] w-full max-w-xs sm:max-w-sm md:max-w-md px-2 sm:px-0">
          <ValidationCard
            type={validationType}
            title={validationType === "success" ? "Logout Successful" : "Server Notice"}
            description={validationMessage}
            onClose={() => setShowValidationCard(false)}
          />
        </div>
      )}
    </div>
  );
}
