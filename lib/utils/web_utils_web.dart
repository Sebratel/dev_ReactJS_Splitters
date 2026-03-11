import 'package:web/web.dart' as web;

class WebUtils {
  static void redirect(String url) {
    web.window.location.replace(url);
  }

  static String get userAgent => web.window.navigator.userAgent;

  static void replaceUrl(String url) {
    web.window.history.replaceState(null, '', url);
  }

  static Map<String, String> get queryParams {
    final href = web.window.location.href;
    final uri = Uri.parse(href);
    if (uri.queryParameters.isNotEmpty) {
      return uri.queryParameters;
    }

    final hashIndex = href.indexOf('#/');
    if (hashIndex != -1) {
      final hashPart = href.substring(hashIndex + 2);
      final hashUri = Uri.parse('http://dummy?$hashPart');
      return hashUri.queryParameters;
    }

    return {};
  }
}
