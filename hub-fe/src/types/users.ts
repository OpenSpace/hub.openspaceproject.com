export interface User {
  id: string;
  name: string;
  username: string;
  thumbnail?: null | Media;
  link?: string;
  contactEmail?: string | null;
  institution: string;
  slackHandle?: string | null;
  updatedAt: Date;
  createdAt: Date;
  email: string;
}

export interface Media {
  id: string;
  alt: string;
  updatedAt: Date;
  createdAt: Date;
  url?: string | null;
  thumbnailURL?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
}
