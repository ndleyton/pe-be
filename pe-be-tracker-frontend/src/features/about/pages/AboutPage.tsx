import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Mail, Github, Linkedin } from 'lucide-react';

const AboutPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto p-8 text-center">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">About</h1>
          <p className="text-muted-foreground mt-1">Get to know the developer</p>
        </div>

        <div className="space-y-6">
          {/* Developer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Developer</CardTitle>
              <CardDescription>
                About the creator of this fitness tracking application
              </CardDescription>
            </CardHeader>
            <CardContent className="text-left">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-lg mb-2">Nicolás Leyton</h3>
                  <p className="text-muted-foreground">
                    Full-stack developer eager to help out clients with their journey via technology.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                Get in touch for questions, feedback, or collaboration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">Email</h3>
                      <p className="text-sm text-muted-foreground">ndleyton@uc.cl</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="mailto:ndleyton@uc.cl">Send Email</a>
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Github className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">GitHub</h3>
                      <p className="text-sm text-muted-foreground">@ndleyton</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://github.com/ndleyton" target="_blank" rel="noopener noreferrer">
                      View Profile
                    </a>
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Linkedin className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">LinkedIn</h3>
                      <p className="text-sm text-muted-foreground">Nicolás Leyton</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://linkedin.com/in/Nicolásleyton" target="_blank" rel="noopener noreferrer">
                      Connect
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle>About This App</CardTitle>
              <CardDescription>
                Personal Exercise Tracker - Built with modern web technologies
              </CardDescription>
            </CardHeader>
            <CardContent className="text-left">
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  This fitness tracking application is designed to help users monitor their exercise routines, 
                  track progress, and seamlessly consult with the latest AI models to help them achieve their goals. Built with React, TypeScript, 
                  and modern web technologies for a smooth user experience.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;