import { Injectable } from "@angular/core";
import { Observable, defer, throwError, of, range } from "rxjs";
import {
  retryWhen,
  flatMap,
  tap,
  delay,
  take,
  map,
  mergeMap,
  mergeAll,
  toArray,
} from "rxjs/operators";
import { environment } from "src/environments/environment";
import { HttpClient } from "@angular/common/http";
import {
  SpotifyAlbumsResponse,
  SpotifyAlbumsResponseItem,
  SpotifyArtistsAlbumsResponse,
} from "./spotify";
import { Media } from "./media";
import SpotifyWebApi from "spotify-web-api-js";

declare const require: any;

@Injectable({
  providedIn: "root",
})
export class SpotifyService {
  spotifyApi: SpotifyWebApi.SpotifyWebApiJs;
  refreshingToken = false;

  constructor(private http: HttpClient) {
    this.spotifyApi = new SpotifyWebApi();
  }

  getMediaByQuery(query: string, category: string): Observable<Media[]> {
    const albums = defer(() =>
      this.spotifyApi.searchAlbums(query, { limit: 1, offset: 0, market: "CH" })
    ).pipe(
      retryWhen((errors) => this.errorHandler(errors)),
      map((response: SpotifyApi.AlbumSearchResponse) => response.albums.total),
      mergeMap((count) => range(0, Math.ceil(count / 50))),
      mergeMap((multiplier) =>
        defer(() =>
          this.spotifyApi.searchAlbums(query, {
            limit: 50,
            offset: 50 * multiplier,
            market: "CH",
          })
        ).pipe(
          retryWhen((errors) => this.errorHandler(errors)),
          map((response: SpotifyApi.AlbumSearchResponse) => {
            return response.albums.items.map((item) => {
              const media: Media = {
                id: item.id,
                artist: item.name,
                title: item.name,
                cover: item.images[0].url,
                type: "spotify",
                category,
              };
              return media;
            });
          })
        )
      ),
      mergeAll(),
      toArray()
    );

    return albums;
  }

  getMediaByArtistID(id: string, category: string): Observable<Media[]> {
    const albums = defer(() =>
      this.spotifyApi.getArtistAlbums(id, {
        include_groups: "album",
        limit: 1,
        offset: 0,
        market: "CH",
      })
    ).pipe(
      retryWhen((errors) => this.errorHandler(errors)),
      map((response: SpotifyApi.ArtistsAlbumsResponse) => response.total),
      mergeMap((count) => range(0, Math.ceil(count / 50))),
      mergeMap((multiplier) =>
        defer(() =>
          this.spotifyApi.getArtistAlbums(id, {
            include_groups: "album",
            limit: 50,
            offset: 50 * multiplier,
            market: "CH",
          })
        ).pipe(
          retryWhen((errors) => this.errorHandler(errors)),
          map((response: SpotifyApi.ArtistsAlbumsResponse) => {
            return response.items.map((item) => {
              const media: Media = {
                id: item.id,
                artist: item.name,
                title: item.name,
                cover: item.images[0].url,
                type: "spotify",
                category,
              };
              return media;
            });
          })
        )
      ),
      mergeAll(),
      toArray()
    );

    return albums;
  }

  getMediaByID(id: string, category: string): Observable<Media> {
    if (category === "playlist") {
      const fetch = this.spotifyApi.getPlaylist;
      return defer(() => fetch(id, { limit: 1, offset: 0, market: "CH" })).pipe(
        retryWhen((errors) => this.errorHandler(errors)),
        map((response: SpotifyApi.SinglePlaylistResponse) => {
          const media: Media = {
            id: response.id,
            artist: response.name,
            title: response.name,
            cover: response?.images[0]?.url,
            type: "spotify",
            category,
          };
          return media;
        })
      );
    } else {
      const fetch = this.spotifyApi.getAlbum;
      return defer(() => fetch(id, { limit: 1, offset: 0, market: "CH" })).pipe(
        retryWhen((errors) => this.errorHandler(errors)),
        map((response: SpotifyApi.SingleAlbumResponse) => {
          const media: Media = {
            id: response.id,
            artist: response.artists?.[0]?.name,
            title: response.name,
            cover: response?.images[0]?.url,
            type: "spotify",
            category,
          };
          return media;
        })
      );
    }
  }

  // Only used for single "artist + title" entries with "type: spotify" in the database.
  // Artwork for spotify search queries are already fetched together with the initial searchAlbums request
  getAlbumArtwork(artist: string, title: string): Observable<string> {
    const artwork = defer(() =>
      this.spotifyApi.searchAlbums("album:" + title + " artist:" + artist, {
        market: "CH",
      })
    ).pipe(
      retryWhen((errors) => this.errorHandler(errors)),
      map((response: SpotifyApi.AlbumSearchResponse) => {
        return response?.albums?.items?.[0]?.images?.[0]?.url || "";
      })
    );

    return artwork;
  }

  refreshToken() {
    const tokenUrl = environment.production
      ? "../api/token"
      : "http://localhost:8200/api/token";

    this.http.get(tokenUrl, { responseType: "text" }).subscribe((token) => {
      this.spotifyApi.setAccessToken(token);
      this.refreshingToken = false;
    });
  }

  errorHandler(errors: Observable<{ status: number }>) {
    return errors.pipe(
      flatMap((error) =>
        error.status !== 401 && error.status !== 429
          ? throwError(error)
          : of(error)
      ),
      tap((_) => {
        if (!this.refreshingToken) {
          this.refreshToken();
          this.refreshingToken = true;
        }
      }),
      delay(500),
      take(10)
    );
  }
}
