import LandingNavbar from './LandingNavbar'
import HeroSection from './HeroSection'
import OrderingChannels from './OrderingChannels'
import HowItWorks from './HowItWorks'
import FeaturesSection from './FeaturesSection'
import CentralManagement from './CentralManagement'
import DashboardSection from './DashboardSection'
import BenefitsSection from './BenefitsSection'
import PricingSection from './PricingSection'
import AudienceSection from './AudienceSection'
import CTASection from './CTASection'
import ContactSection from './ContactSection'
import LandingFooter from './LandingFooter'

export default function LandingPage() {
  return (
    <div className="text-slate-900">
      <LandingNavbar />
      <main>
        <HeroSection />
        <OrderingChannels />
        <HowItWorks />
        <FeaturesSection />
        <CentralManagement />
        <DashboardSection />
        <BenefitsSection />
        <PricingSection />
        <AudienceSection />
        <CTASection />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  )
}
