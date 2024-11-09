import { Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router, NavigationExtras } from "@angular/router";
import { MediaService } from "../service/media.service";
import { ArtworkService } from "../service/artwork.service";
import { PlayerService } from "../service/player.service";
import { Media } from "../service/media";
import { Artist } from "../service/artist";

@Component({
  selector: "app-medialist",
  templateUrl: "./medialist.page.html",
  styleUrls: ["./medialist.page.scss"],
})
export class MedialistPage implements OnInit {
  artist!: Artist;
  media: Media[] = [];
  covers: Record<string, string> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mediaService: MediaService,
    private artworkService: ArtworkService,
    private playerService: PlayerService
  ) {
    this.route.queryParams.subscribe((params) => {
      if (this.router.getCurrentNavigation()?.extras.state) {
        this.artist =
          this.router.getCurrentNavigation()?.extras?.state?.["artist"];
      }
    });
  }

  ngOnInit() {
    // Subscribe
    this.mediaService.getMediaFromArtist(this.artist).subscribe((media) => {
      this.media = media;

      this.media.forEach((currentMedia) => {
        this.artworkService.getArtwork(currentMedia).subscribe((url) => {
          if (currentMedia.title) {
            this.covers[currentMedia.title] = url;
          }
        });
      });
      // this.slider.update();

      // Workaround as the scrollbar handle isn't visible after the immediate update
      // Seems like a size calculation issue, as resizing the browser window helps
      // Better fix for this?
      window.setTimeout(() => {
        // this.slider.update();
      }, 1000);
    });

    // Retreive data through subscription above
    this.mediaService.publishArtistMedia();
  }

  coverClicked(clickedMedia: Media) {
    const navigationExtras: NavigationExtras = {
      state: {
        media: clickedMedia,
      },
    };
    this.router.navigate(["/player"], navigationExtras);
  }

  mediaNameClicked(clickedMedia: Media) {
    this.playerService.getConfig().subscribe((config) => {
      if (config.tts == null || config.tts.enabled === true) {
        if (clickedMedia.title) {
          this.playerService.say(clickedMedia.title);
        }
      }
    });
  }

  slideDidChange() {
    // console{}.log('Slide did change');
  }

  slidePrev() {
    // this.slider.slidePrev();
  }

  slideNext() {
    // this.slider.slideNext();
  }
}
