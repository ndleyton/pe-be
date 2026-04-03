
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Mail, Github, Linkedin, ExternalLink } from "lucide-react";

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
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Reach me at{" "}
            <a className="text-foreground underline underline-offset-4" href="mailto:ndleyton@uc.cl">
              ndleyton@uc.cl
            </a>{" "}
            or on{" "}
            <a
              className="text-foreground underline underline-offset-4"
              href="https://www.linkedin.com/in/nicolas-d-leyton/"
              rel="noopener noreferrer"
              target="_blank"
            >
              LinkedIn
            </a>
            .
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
                <Github className="h-5 w-5" />
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
                <Linkedin className="h-5 w-5" />
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
