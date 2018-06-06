/*
  * @package Barrier
  * @subpackage arrier HTML
  * 
  * Template Scripts
  * Created by Esrat
  
  1. Fixed header
  2. Site search
  3. Main slideshow
  4. Owl Carousel
      a. Testimonial
      b. Clients
      c. Team
  5. Back to top
  6. Skills
  7. BX slider
      a. Blog Slider
      b. Portfolio item slider
  8. Isotope
  9. Animation (wow)
  10. Flickr
  
*/


jQuery(function($) {
  "use strict";
  
  
  $.noConflict();
     $('.navbar-nav a').on('click', function(){ 
        if($('.navbar-toggle').css('display') !='none'){
            $(".navbar-toggle").trigger( "click" );
        }
    });
     
   /* ----------------------------------------------------------- */
   /*  Style Switcher
   /* ----------------------------------------------------------- */

    // (function($) { "use strict";
    //    $(document).ready(function(){
           $('.style-switch-button').click(function(){
           $('.style-switch-wrapper').toggleClass('active');
           });
           $('a.close-styler').click(function(){
           $('.style-switch-wrapper').removeClass('active');
           });
    //   });
    // })(jQuery);

  
    /* ----------------------------------------------------------- */
   /*  Animation
   /* ----------------------------------------------------------- */
        new WOW().init();

    /* ----------------------------------------------------------- */
   /*  Counter
   /* ----------------------------------------------------------- */
    $('.counter').counterUp({
            delay: 100,
            time: 2000
        });

   /* ----------------------------------------------------------- */
   /*  Contact map
   /* ----------------------------------------------------------- */
    var map;
        map = new GMaps({
          div: '#map',
          lat: 23.709921,
          lng: 90.407143,
          scrollwheel: false,
          panControl: false,
          zoomControl: false,
        });

        map.addMarker({
          lat: 23.709921,
          lng: 90.407143,
        });


    /* ----------------------------------------------------------- */
   /*  Prettyphoto
   /* ----------------------------------------------------------- */
        $("a[data-rel^='prettyPhoto']").prettyPhoto();
  

       
   /* ==============================================
      Menu toggle
    =============================================== */ 
    
      $('a.page-scroll').click(function() {
          if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
            if (target.length) {
              $('html,body').animate({
                scrollTop: target.offset().top - 40
              }, 900);
              return false;
            }
          }
        });


    /*==================================================
    Show Menu on Book
    ====================================================*/
    
    $(window).bind('scroll', function() {
        var navHeight = $(window).height() - 40;
        if ($(window).scrollTop() > navHeight) {
            $('.navbar-default').addClass('on');
        } else {
            $('.navbar-default').removeClass('on');
        }
    });

    $('body').scrollspy({ 
        target: '.navbar-default',
        offset: 80
    })
   


  // // accordian
  // $('.accordion-toggle').on('click', function(){
  //   $(this).closest('.panel-group').children().each(function(){
  //   $(this).find('>.panel-heading').removeClass('active');
  //    });

  //   $(this).closest('.panel-heading').toggleClass('active');
  // });
  
      //Portfolio item and blog slider
    
/*Smooth Scroll*/
      smoothScroll.init({
          speed: 400,
          easing: 'easeInQuad',
          offset:0,
          updateURL: true,
          callbackBefore: function ( toggle, anchor ) {},
          callbackAfter: function ( toggle, anchor ) {}
        }); 


  /* ----------------------------------------------------------- */
  /*  Main slideshow
  /* ----------------------------------------------------------- */

  $('#slider').Carousel({
    pause: true,
    interval: 100000,
    pagination:true
  });



    
  // Feature -tab

    $('#feature-tab a:last').tab('show')

     $('.landing-tab ul li a:last').tab('show')



});