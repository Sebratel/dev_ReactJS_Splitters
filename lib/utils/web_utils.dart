// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

class WebUtils {
  static void redirect(String url) {
    html.window.location.replace(url);
  }

  static String get userAgent {
    return html.window.navigator.userAgent;
  }

  static Map<String, String> get queryParams {
    final href = html.window.location.href;

    // tenta parâmetros normais ?token=
    final uri = Uri.parse(href);
    if (uri.queryParameters.isNotEmpty) {
      return uri.queryParameters;
    }

    // tenta parâmetros dentro do hash #/?token=
    final hashIndex = href.indexOf('#/');
    if (hashIndex != -1) {
      final hashPart = href.substring(hashIndex + 2);
      final hashUri = Uri.parse('http://dummy?$hashPart');
      return hashUri.queryParameters;
    }

    return {};
  }
}
