import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Mail, Github, Linkedin, ExternalLink } from 'lucide-react';

const AboutPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            About Me
          </h1>
          <p className="text-muted-foreground">Full-Stack Software Engineer</p>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Nicolás Leyton</CardTitle>
            <CardDescription className="text-base">
              Full-Stack Software Engineer eager to help clients achieve their goals through technology.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent my-4" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              When I'm not coding, you can find me working out, bouldering or taking pictures (never at the same time).
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Get In Touch</CardTitle>
            <CardDescription>Feel free to reach out for collaboration or just to say hi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <a 
                href="mailto:ndleyton@uc.cl" 
                className="group flex items-center gap-4 p-3 -mx-3 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium">Email</h3>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    ndleyton@uc.cl
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>

              <a 
                href="https://github.com/ndleyton" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-3 -mx-3 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-foreground">
                  <Github className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium">GitHub</h3>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    @ndleyton
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>

              <a 
                href="https://www.linkedin.com/in/nicolas-d-leyton/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-3 -mx-3 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-[#0A66C2]">
                  <Linkedin className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium">LinkedIn</h3>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Nicolás Leyton
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">About This App</CardTitle>
            <CardDescription>Personal Exercise Tracker - Built with modern web technologies</CardDescription>
          </CardHeader>
          <CardContent className="text-left">
            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  This fitness tracking application is designed to help users monitor their exercise routines, 
                  track progress, and seamlessly consult with the latest AI models to help them achieve their goals. You can reach out for implementation questions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};

export default AboutPage;