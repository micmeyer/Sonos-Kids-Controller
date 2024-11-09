import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, from, of, iif, Subject } from "rxjs";
import { map, mergeMap, tap, toArray, mergeAll, filter } from "rxjs/operators";
import { environment } from "../environments/environment";
import { SpotifyService } from "./spotify.service";
import { Media } from "./media";
import { Artist } from "./artist";

@Injectable({
  providedIn: "root",
})
export class MediaService {
  private category = "audiobook";

  private rawMediaSubject = new Subject<Media[]>();

  private artistSubject = new Subject<Media[]>();
  private mediaSubject = new Subject<Media[]>();
  private artistMediaSubject = new Subject<Media[]>();

  constructor(
    private http: HttpClient,
    private spotifyService: SpotifyService
  ) {}

  // --------------------------------------------
  // Handling of RAW media entries from data.json
  // --------------------------------------------

  getRawMediaObservable() {
    return this.rawMediaSubject;
  }

  updateRawMedia() {
    const url = environment.production
      ? "../api/data"
      : "http://localhost:8200/api/data";
    this.http.get<Media[]>(url).subscribe((media) => {
      this.rawMediaSubject.next(media);
    });
  }

  deleteRawMediaAtIndex(index: number) {
    const url = environment.production
      ? "../api/delete"
      : "http://localhost:8200/api/delete";
    const body = {
      index,
    };

    this.http.post(url, body).subscribe((response) => {
      this.updateRawMedia();
    });
  }

  addRawMedia(media: Media) {
    const url = environment.production
      ? "../api/add"
      : "http://localhost:8200/api/add";

    this.http.post(url, media).subscribe((response) => {
      this.updateRawMedia();
    });
  }

  // Get the media data for the current category from the server
  private updateMedia() {
    const url = environment.production
      ? "../api/data"
      : "http://localhost:8200/api/data";

    return this.http.get<Media[]>(url).pipe(
      map((items) => {
        // Filter to get only items for the chosen category
        items.forEach(
          (item) =>
            (item.category =
              item.category === undefined ? "audiobook" : item.category)
        ); // default category
        items = items.filter((item) => item.category === this.category);
        return items;
      }),
      mergeMap((items) => from(items)), // parallel calls for each item
      map(
        (
          item // get media for the current item
        ) =>
          iif(
            () => (item.query && item.query.length > 0 ? true : false), // Get media by query
            this.spotifyService
              .getMediaByQuery(item.query!, item.category)
              .pipe(
                map((items) => {
                  return items.filter(
                    (mediaItem) =>
                      item.filter !== "strict" ||
                      mediaItem.artist === item.artist
                  );
                }),
                map((items) => {
                  this.patchArtistNames(item, items);
                  return items;
                })
              ),
            iif(
              () => (item.artistid && item.artistid.length > 0 ? true : false), // Get media by artist
              this.spotifyService
                .getMediaByArtistID(item.artistid!, item.category)
                .pipe(
                  map((items) => {
                    this.patchArtistNames(item, items);
                    return items;
                  })
                ),
              iif(
                () =>
                  item.type === "spotify" && item.id && item.id.length > 0
                    ? true
                    : false, // Get media by album
                this.spotifyService.getMediaByID(item.id!, item.category).pipe(
                  map((currentItem) => {
                    this.patchArtistName(item, currentItem);
                    this.patchAlbumName(item, currentItem);
                    return [currentItem];
                  })
                ),
                of([item]) // Single album. Also return as array, so we always have the same data type
              )
            )
          )
      ),
      mergeMap((items) => from(items)), // seperate arrays to single observables
      mergeAll(), // merge everything together
      toArray(), // convert to array
      map((media) => {
        // add dummy image for missing covers
        return media.map((currentMedia) => {
          if (!currentMedia.cover) {
            currentMedia.cover = "../assets/images/nocover.png";
          }
          return currentMedia;
        });
      })
    );
  }

  private patchAlbumName(template: Media, mediaItem: Media) {
    if (template.title && template.title.length > 0) {
      mediaItem.title = template.title;
    }
  }

  private patchArtistName(template: Media, mediaItem: Media) {
    if (template.artist && template.artist.length > 0) {
      mediaItem.artist = template.artist;
    }
  }

  // If the user entered an user-defined artist name in addition to a query, overwrite orignal artist from spotify
  private patchArtistNames(template: Media, mediaItems: Media[]) {
    if (template.artist && template.artist.length > 0) {
      mediaItems.forEach((currentItem) => {
        currentItem.artist = template.artist;
      });
    }
  }

  publishArtists() {
    this.updateMedia().subscribe((media) => {
      this.artistSubject.next(media);
    });
  }

  publishMedia() {
    this.updateMedia().subscribe((media) => {
      this.mediaSubject.next(media);
    });
  }

  publishArtistMedia() {
    this.updateMedia().subscribe((media) => {
      this.artistMediaSubject.next(media);
    });
  }

  // Get all artists for the current category
  getArtists(): Observable<Artist[]> {
    return this.artistSubject.pipe(
      map((media: Media[]) => {
        // Create temporary object with artists as keys and albumCounts as values
        const mediaCounts: Record<string, number> = media.reduce(
          (tempCounts: Record<string, number>, currentMedia) => {
            tempCounts[currentMedia.artist!] =
              (tempCounts[currentMedia.artist!] || 0) + 1;
            return tempCounts;
          },
          {}
        );

        // Create temporary object with artists as keys and covers (first media cover) as values
        const covers = media
          .sort((a, b) => (a.title! <= b.title! ? -1 : 1))
          .reduce((tempCovers: Record<string, string>, currentMedia) => {
            if (!tempCovers[currentMedia.artist!]) {
              tempCovers[currentMedia.artist!] = currentMedia.cover!;
            }
            return tempCovers;
          }, {});

        // Create temporary object with artists as keys and first media as values
        const coverMedia = media
          .sort((a, b) => (a.title! <= b.title! ? -1 : 1))
          .reduce((tempMedia: Record<string, Media>, currentMedia) => {
            if (!tempMedia[currentMedia.artist!]) {
              tempMedia[currentMedia.artist!] = currentMedia;
            }
            return tempMedia;
          }, {});

        // Build Array of Artist objects sorted by Artist name
        const artists: Artist[] = Object.keys(mediaCounts)
          .sort()
          .map((currentName) => {
            const artist: Artist = {
              name: currentName,
              albumCount: mediaCounts[currentName],
              cover: covers[currentName],
              coverMedia: coverMedia[currentName],
            };
            return artist;
          });

        return artists;
      })
    );
  }

  // Collect albums from a given artist in the current category
  getMediaFromArtist(artist: Artist): Observable<Media[]> {
    return this.artistMediaSubject.pipe(
      map((media: Media[]) => {
        return media
          .filter((currentMedia) => currentMedia.artist === artist.name)
          .sort((a, b) =>
            a.title!.localeCompare(b.title!, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
      })
    );
  }

  // Get all media entries for the current category
  getMedia(): Observable<Media[]> {
    return this.mediaSubject.pipe(
      map((media: Media[]) => {
        return media.sort((a, b) =>
          a.title!.localeCompare(b.title!, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );
      })
    );
  }

  // Choose which media category should be displayed in the app
  setCategory(category: string) {
    this.category = category;
  }
}
