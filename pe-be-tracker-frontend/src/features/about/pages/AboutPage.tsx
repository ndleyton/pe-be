import type { SVGProps } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Mail, ExternalLink } from "lucide-react";

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
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 sm:p-8">
      <div className="space-y-2 text-center">
        <h1 className="from-primary to-primary/80 bg-gradient-to-r bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          About Me
        </h1>
        <p className="text-muted-foreground">Full-Stack Software Engineer</p>
      </div>

      <Card className="border-border/50 overflow-hidden shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Nicolas Leyton</CardTitle>
          <CardDescription className="text-base">
            Nicolas Leyton is a Full-Stack Software Engineer eager to help
            clients achieve their goals through technology.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="via-border/50 my-4 h-px bg-gradient-to-r from-transparent to-transparent" />
          <p className="text-muted-foreground text-sm leading-relaxed">
            When I'm not coding, you can find me working out, bouldering or
            taking pictures (never at the same time).
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Get In Touch</CardTitle>
          <CardDescription>
            Feel free to reach out for collaboration or just to say hi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <a
              href="mailto:ndleyton@uc.cl"
              className="group hover:bg-accent/50 -mx-3 flex items-center gap-4 rounded-lg p-3 transition-colors"
            >
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium">Email</h3>
                <p className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
                  ndleyton@uc.cl
                </p>
              </div>
              <ExternalLink className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>

            <a
              href="https://github.com/ndleyton"
              target="_blank"
              rel="noopener noreferrer"
              className="group hover:bg-accent/50 -mx-3 flex items-center gap-4 rounded-lg p-3 transition-colors"
            >
              <div className="bg-primary/10 text-foreground flex h-10 w-10 items-center justify-center rounded-full">
                <GitHubIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium">GitHub</h3>
                <p className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
                  @ndleyton
                </p>
              </div>
              <ExternalLink className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>

            <a
              href="https://www.linkedin.com/in/nicolas-d-leyton/"
              target="_blank"
              rel="noopener noreferrer"
              className="group hover:bg-accent/50 -mx-3 flex items-center gap-4 rounded-lg p-3 transition-colors"
            >
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full text-[#0A66C2]">
                <LinkedInIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium">LinkedIn</h3>
                <p className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
                  Nicolas Leyton
                </p>
              </div>
              <ExternalLink className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">About This App</CardTitle>
          <CardDescription>
            Personal Exercise Tracker - Built with modern web technologies
          </CardDescription>
        </CardHeader>
        <CardContent className="text-left">
          <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
            <div className="space-y-3">
              <p className="text-muted-foreground">
                This fitness tracking application is designed to help users
                monitor their exercise routines, track progress, and seamlessly
                consult with the latest AI models to help them achieve their
                goals. Built by Nicolas Leyton. You can reach out for
                implementation questions at ndleyton@uc.cl or on LinkedIn.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutPage;
