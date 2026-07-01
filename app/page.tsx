import Link from 'next/link';
import VoiceWidget from '@/components/VoiceWidget/VoiceWidget';

export default function Home() {
  return (
    <div className="bg-obsidian text-soft-ivory selection:bg-brushed-gold/30 min-h-screen flex flex-col w-full">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-charcoal/75 backdrop-blur-xl border-b border-primary/20 shadow-[0px_10px_30px_rgba(212,175,55,0.1)]">
        <div className="flex justify-between items-center px-margin-desktop py-6 w-full max-w-container-max mx-auto">
          <div className="font-headline-md text-headline-md font-bold text-primary tracking-widest cursor-pointer active:scale-95 transition-transform">
            AETHER
          </div>
          <div className="hidden md:flex gap-10 items-center">
            <a className="font-label-lg text-label-lg text-on-surface-variant hover:text-warm-amber transition-colors duration-300" href="#">Experience</a>
            <a className="font-label-lg text-label-lg text-on-surface-variant hover:text-warm-amber transition-colors duration-300" href="#">Menu</a>
            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-warm-amber transition-colors duration-300" href="/reserve">Reservations</Link>
            <a className="font-label-lg text-label-lg text-on-surface-variant hover:text-warm-amber transition-colors duration-300" href="#">Private Dining</a>
          </div>
          <Link href="/reserve" className="px-6 py-2.5 border border-brushed-gold text-brushed-gold font-label-lg text-label-lg rounded-lg hover:bg-brushed-gold hover:text-obsidian transition-all duration-300 amber-glow-hover active:scale-95 text-center">
            Book a Table
          </Link>
        </div>
      </nav>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-obsidian/60 via-obsidian/40 to-obsidian z-10"></div>
            <img 
              className="w-full h-full object-cover" 
              alt="A moody, high-end restaurant interior captured in low light. Flickering candles illuminate pristine white tablecloths and crystal glassware." 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDl5JsRq-7mzkJNJXh6PK0Wbl6eoXBLYicW-AhDLim50HJC49NFx6JJdwj95IwhZbbSTPhPSrJG_RdTWSVfhrqypBpVjZOKPTluh-bCpzsyznpp23uwnyW-ytDhBpIKvLM6wKvcGCu__G0OfMpD2mEJn_4Ude-xJOhHC-u-9QhR1Uuoo1QcO7nvfZm9NjqBBpx6j0vTvZb9AwnEHg5Cz0qvjRNyXKFFccsRLVtbBlvbkU7QYXjQ7IGeo_pQaOyP8GQ3iJqfRjDfig"
            />
          </div>
          <div className="relative z-20 text-center px-margin-mobile max-w-4xl mx-auto space-y-8">
            <span className="block font-label-lg text-label-lg text-brushed-gold tracking-[0.3em] uppercase opacity-0 translate-y-4 animate-[fadeIn_0.8s_ease-out_forwards]">Est. 2024</span>
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-soft-ivory leading-tight opacity-0 translate-y-8 animate-[fadeIn_1s_ease-out_0.3s_forwards]">
              Artisanal Cuisine,<br/>
              <span className="italic font-normal">Crafted for the Senses</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto opacity-0 translate-y-8 animate-[fadeIn_1s_ease-out_0.6s_forwards]">
              An immersive journey through seasonal ingredients and avant-garde technique. Rediscover the ritual of dining in an atmosphere of obsidian elegance.
            </p>
            <div className="pt-8 opacity-0 translate-y-8 animate-[fadeIn_1s_ease-out_0.9s_forwards]">
              <button className="px-10 py-5 bg-gradient-to-r from-brushed-gold to-warm-amber text-obsidian font-bold rounded-lg font-label-lg text-label-lg hover:scale-105 transition-all duration-500 amber-glow shadow-xl cursor-pointer">
                Explore the Menu
              </button>
            </div>
          </div>
        </section>

        {/* Signature Experience Grid */}
        <section className="py-section-gap px-margin-desktop max-w-container-max mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-xl">
              <h2 className="font-headline-xl text-headline-xl text-soft-ivory mb-4">A Symphony of Flavors</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Every dish is a canvas, every meal a performance. We curate fleeting moments into lasting memories.</p>
            </div>
            <div className="flex gap-4">
              <button className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center hover:border-primary transition-colors text-primary cursor-pointer">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <button className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center hover:border-primary transition-colors text-primary cursor-pointer">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Bento Card 1 */}
            <div className="md:col-span-2 group relative h-[500px] rounded-xl overflow-hidden glass-panel p-8 flex flex-col justify-end">
              <img 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" 
                alt="Close up of an exquisitely plated fine dining course." 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4H-DKxLjrHmkiGnImVXeA-BtgW83PocssPa7ImHTUvsuNg5ISxd2hBNZxnmFtL9Nvru9iBUJ-vZcGfrz2PLENpOJ_M4yPznFvsfGIbszMH6g3tPk4euG38G4EWjQaiEPjAlvUpLGEMJ-61zjxOgbB_Bt8SbLezd3GDsvpoak-CGEqgdd2IVxaaeua_EA0epmGOwuLhEEdcxyKzaE4Ckb0LeppIwILnAq6WFl1_elFjWHFmU65DSgZdW-ZzNv5YQIDHOfFw5Fjiw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent"></div>
              <div className="relative z-10">
                <span className="font-label-sm text-label-sm text-brushed-gold mb-2 block">The Tasting Menu</span>
                <h3 className="font-headline-lg text-headline-lg text-soft-ivory mb-4">Odyssey of Taste</h3>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-md">An 11-course exploration of the earth, sea, and imagination.</p>
              </div>
            </div>
            {/* Bento Card 2 */}
            <div className="group relative h-[500px] rounded-xl overflow-hidden glass-panel p-8 flex flex-col justify-end">
              <img 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-50" 
                alt="A sophisticated cocktail being prepared in a crystal glass." 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUtvvx_u38HuuM3oIUSYvefZSIK0PlELMuCoQphfHXfzpNbdpdszdSunAgvemEaILbCORhjvi6m1tMVpJF8s8PwwbJy1iea4UEjPRSZdJ4MCLo5wiyaFQEhb3PeH7mNAOJ6-mY6N7TLwgjs7NUpck5M5ry2nCVQZD0qqdNVNnEgNTSrrv1Nxem_FY6ewLcGaSQG_B2HwHwYaHt1LzW6LuVkS0q342JoyiUos_bur-ROKlfVOBleXrO_DkQd1HbjcNNS_qvuVe1Eg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent"></div>
              <div className="relative z-10">
                <span className="font-label-sm text-label-sm text-brushed-gold mb-2 block">The Cellar</span>
                <h3 className="font-headline-lg text-headline-lg text-soft-ivory mb-4">Vintages & Spirits</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Rare finds from the world's most prestigious vineyards.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-section-gap bg-surface-container-lowest border-t border-primary/10 mt-section-gap">
        <div className="flex flex-col items-center gap-gutter w-full max-w-container-max mx-auto px-margin-desktop">
          <div className="font-headline-lg text-headline-lg text-primary tracking-widest mb-4">AETHER</div>
          <div className="flex flex-wrap justify-center gap-10">
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Privacy Policy</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Terms of Service</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Press Kit</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Contact</a>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-40 mt-8">© 2024 AETHER HOSPITALITY GROUP. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>

      {/* Voice Agent Widget Overlay */}
      <VoiceWidget />
    </div>
  );
}
