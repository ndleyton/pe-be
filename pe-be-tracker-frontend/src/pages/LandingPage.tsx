
import React from 'react';
import { HomeLogo } from '@/shared/components/layout';

const LandingPage: React.FC = () => {
  return (
    <div className="bg-background text-foreground">
      {/* Hero Section */}
      <header className="bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <HomeLogo />
        </div>
        <div className="container mx-auto px-6 pb-16 text-center">
          <h1 className="text-5xl font-bold text-card-foreground md:text-6xl">
            Your Fitness Journey Companion to Achieve Your Personal Best.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Your AI-powered fitness companion that understands your workout history, helping you achieve your personal best.
          </p>
          <div className="mt-8">
            <a
              href="/login"
              className="bg-primary text-primary-foreground font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-colors duration-300"
            >
              Get Started for Free
            </a>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <main className="container mx-auto px-6 py-24">
        <h2 className="text-4xl font-bold text-center text-card-foreground">
          Why You'll Love Personal Bestie
        </h2>
        <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {/* Feature 1 */}
          <div className="bg-card p-8 rounded-xl shadow-lg">
            <h3 className="text-2xl font-bold text-card-foreground">Comprehensive Workout Tracking</h3>
            <p className="mt-4 text-muted-foreground">
              Log every detail of your workouts, from exercises and sets to reps, weight, and rest times.
            </p>
          </div>
          {/* Feature 2 */}
          <div className="bg-card p-8 rounded-xl shadow-lg">
            <h3 className="text-2xl font-bold text-card-foreground">In-Depth Progress Analytics</h3>
            <p className="mt-4 text-muted-foreground">
              Visualize your progress with detailed charts and analytics. Understand your performance and stay motivated.
            </p>
          </div>
          {/* Feature 3 */}
          <div className="bg-card p-8 rounded-xl shadow-lg">
            <h3 className="text-2xl font-bold text-card-foreground">Customizable Exercise Library</h3>
            <p className="mt-4 text-muted-foreground">
              Create your own exercises or choose from our extensive library to build your perfect workout routine.
            </p>
          </div>
          {/* Feature 4 */}
          <div className="bg-card p-8 rounded-xl shadow-lg">
            <h3 className="text-2xl font-bold text-card-foreground">Workout Recipes & Templates</h3>
            <p className="mt-4 text-muted-foreground">
              Save your favorite workout routines as templates and reuse them to save time and stay consistent.
            </p>
          </div>
          {/* Feature 5 */}
          <div className="bg-card p-8 rounded-xl shadow-lg">
            <h3 className="text-2xl font-bold text-card-foreground">Guest Mode with Seamless Sync</h3>
            <p className="mt-4 text-muted-foreground">
              Try the app without an account. Your data is saved locally and syncs automatically when you sign up.
            </p>
          </div>
          {/* Feature 6 */}
          <div className="bg-card p-8 rounded-xl shadow-lg">
            <h3 className="text-2xl font-bold text-card-foreground">AI-Powered Fitness Chat</h3>
            <p className="mt-4 text-muted-foreground">
              Chat with our AI assistant that knows your workout history and provides personalized guidance.
            </p>
          </div>
        </div>
      </main>

      {/* CTA Section */}
      <section className="bg-primary">
        <div className="container mx-auto px-6 py-20 text-center text-primary-foreground">
          <h2 className="text-4xl font-bold">Ready to Reach Your Peak?</h2>
          <p className="mt-4 text-lg">
            Join thousands of athletes who use Personal Bestie to track their fitness journey.
          </p>
          <div className="mt-8">
            <a
              href="/login"
              className="bg-primary-foreground text-primary font-bold py-3 px-8 rounded-lg hover:bg-primary-foreground/90 transition-colors duration-300"
            >
              Start Your Journey
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card">
        <div className="container mx-auto px-6 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 Personal Bestie. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
