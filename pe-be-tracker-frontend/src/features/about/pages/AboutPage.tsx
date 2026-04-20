import { useState, type SVGProps } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Mail, ExternalLink, User, Camera, Dumbbell, MapPin, Github, Code2, Heart } from "lucide-react";

const GitHubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.94c-2.94.64-3.56-1.25-3.56-1.25-.48-1.2-1.16-1.52-1.16-1.52-.95-.65.07-.64.07-.64 1.04.08 1.59 1.07 1.59 1.07.94 1.6 2.45 1.13 3.05.87.1-.68.36-1.13.65-1.39-2.35-.27-4.82-1.18-4.82-5.25 0-1.16.42-2.1 1.08-2.85-.11-.27-.47-1.36.1-2.83 0 0 .9-.29 2.94 1.09a10.12 10.12 0 0 1 5.36 0c2.04-1.38 2.94-1.09 2.94-1.09.57 1.47.21 2.56.1 2.83.67.75 1.08 1.69 1.08 2.85 0 4.08-2.47 4.97-4.83 5.24.37.32.7.96.7 1.94v2.88c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z" />
  </svg>
);

const LinkedInIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M6.94 8.5H3.56V20h3.38V8.5Zm.22-3.56A1.96 1.96 0 0 0 5.2 3a1.97 1.97 0 1 0 0 3.94 1.96 1.96 0 0 0 1.96-2ZM20 12.86c0-3.46-1.85-5.07-4.32-5.07-1.99 0-2.88 1.1-3.38 1.87V8.5H8.94c.04.78 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.13-.92.27-.68.88-1.38 1.9-1.38 1.34 0 1.88 1.03 1.88 2.54V20H20v-7.14Z" />
  </svg>
);

const AboutPage = () => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:p-8 animate-in fade-in duration-700">
      <div className="mb-12 text-center sm:mb-16 animate-in fade-in slide-in-from-top-8 duration-1000">
        <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-6xl text-glow bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          About
        </h1>
        <p className="mt-4 text-muted-foreground font-medium tracking-wide uppercase text-xs sm:text-sm">
          The project and the developer
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-12">
        {/* App Info Card */}
        <Card className="bg-card/40 border-border/20 overflow-hidden rounded-3xl border p-8 shadow-lg backdrop-blur-md transition-all hover:border-primary/20 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
          <CardHeader className="px-0 pt-0 text-left">
            <div className="flex items-center justify-between gap-4 mb-2">
              <CardTitle className="text-3xl font-black tracking-tight">PersonalBestie</CardTitle>
              <a
                href="https://github.com/ndleyton/pe-be"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
              >
                <GitHubIcon className="h-4 w-4" />
                GitHub
              </a>
            </div>
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-6">
              <Code2 className="h-4 w-4" />
              <span>Open Source</span>
              <span className="text-muted-foreground/40 mx-1">•</span>
              <Heart className="h-4 w-4 fill-current text-rose-500" />
              <span className="text-rose-500">Built for you</span>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 text-left">
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <p className="text-muted-foreground leading-relaxed text-lg">
                This fitness tracking application is designed to help users
                monitor their exercise routines, track progress, and seamlessly
                consult with the latest AI models to help them achieve their
                goals.
              </p>
              <div className="mt-8">
                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground/50 mb-3 ml-1">Powered by</h4>
                <div className="flex flex-wrap gap-2">
                  {["React 19", "TypeScript", "FastAPI", "PostgreSQL", "Gemini AI", "Tailwind v4"].map((tech) => (
                    <span key={tech} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg text-xs font-bold transition-all hover:bg-primary/20">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Card */}
        <Card className="bg-card/40 border-border/20 overflow-hidden rounded-3xl border p-8 shadow-2xl backdrop-blur-md transition-all hover:border-primary/20 group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start text-left">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary to-primary-foreground opacity-20 blur-lg group-hover:opacity-40 transition-opacity" />
              <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-accent border border-border/50 text-primary-foreground shadow-xl transition-transform duration-500 group-hover:scale-[1.03]">
                {!imageError ? (
                  <img
                    src="/profile.jpg"
                    alt="Nicolas Leyton"
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="text-4xl font-black text-primary">NL</span>
                )}
              </div>
            </div>
            <div className="space-y-6 w-full">
              <div className="space-y-2 text-center sm:text-left">
                <CardTitle className="text-3xl font-black tracking-tight">Nicolas Leyton</CardTitle>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-muted-foreground">
                   <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20 transition-colors hover:bg-primary/20">
                     <MapPin className="h-3 w-3" />
                     Santiago, CL
                   </div>
                </div>
              </div>
              <div className="prose prose-neutral dark:prose-invert">
                <p className="text-foreground/80 leading-relaxed text-lg italic">
                  "Nicolas Leyton is a Full-Stack Software Engineer eager to help
                  clients achieve their goals through technology."
                </p>
                <div className="mt-6 flex flex-wrap justify-center sm:justify-start gap-4 text-muted-foreground text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    Working out
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Bouldering
                  </div>
                  <div className="flex items-center gap-2 transition-colors hover:text-primary">
                    <Camera className="h-4 w-4 text-primary" />
                    Photography
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Get In Touch Grid */}
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
          <div className="text-left px-2">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Get In Touch</h2>
            <p className="text-muted-foreground font-medium">Feel free to reach out for collaboration</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <a
              href="mailto:ndleyton@uc.cl"
              className="group bg-card/40 border-border/20 hover:bg-accent/40 hover:border-primary/30 flex flex-col items-center gap-4 rounded-3xl border p-8 transition-all hover:scale-[1.02] shadow-sm hover:shadow-xl backdrop-blur-sm"
            >
              <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
                <Mail className="h-7 w-7" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-lg">Email</h3>
                <p className="text-muted-foreground text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                  ndleyton@uc.cl
                </p>
              </div>
              <ExternalLink className="absolute top-4 right-4 text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" />
            </a>

            <a
              href="https://github.com/ndleyton"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card/40 border-border/20 hover:bg-accent/40 hover:border-primary/30 flex flex-col items-center gap-4 rounded-3xl border p-8 transition-all hover:scale-[1.02] shadow-sm hover:shadow-xl backdrop-blur-sm"
            >
              <div className="bg-primary/10 text-foreground flex h-14 w-14 items-center justify-center rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
                <GitHubIcon className="h-7 w-7" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-lg">GitHub</h3>
                <p className="text-muted-foreground text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                  @ndleyton
                </p>
              </div>
              <ExternalLink className="absolute top-4 right-4 text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" />
            </a>

            <a
              href="https://www.linkedin.com/in/nicolas-d-leyton/"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card/40 border-border/20 hover:bg-accent/40 hover:border-primary/30 flex flex-col items-center gap-4 rounded-3xl border p-8 transition-all hover:scale-[1.02] shadow-sm hover:shadow-xl backdrop-blur-sm"
            >
              <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-2xl text-[#0A66C2] group-hover:scale-110 transition-transform shadow-inner">
                <LinkedInIcon className="h-7 w-7" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-lg">LinkedIn</h3>
                <p className="text-muted-foreground text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                  Nicolas Leyton
                </p>
              </div>
              <ExternalLink className="absolute top-4 right-4 text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
